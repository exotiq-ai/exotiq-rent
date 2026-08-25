import { describe, expect, it } from 'vitest';
import { adaptBusyRanges, adaptFleetVehicle, adaptQuote, adaptTeam, adaptVehicleDetail, dollarsToCents } from './adapters';
import type { RpcQuoteRow, RpcTeamRow, RpcVehicleDetailRow } from './rpcClient';

// Fixtures mirror the RETURNS TABLE shapes of the applied M3 migration
// (20260715220100_rent_public_read_rpcs.sql) — these are contract tests for
// the adapter boundary: dollars in, integer cents out, no PII fields.

const teamRow: RpcTeamRow = {
  slug: 'exotiq-pilot',
  name: 'Exotiq Pilot Fleet',
  logo_url: null,
  public_description: 'Pilot operator.',
  city: 'Scottsdale',
  state: 'AZ',
  timezone: 'America/Phoenix',
  currency: 'usd',
};

const vehicleRow: RpcVehicleDetailRow = {
  vehicle_slug: '2024-mclaren-750s',
  team_slug: 'exotiq-pilot',
  team_name: 'Exotiq Pilot Fleet',
  name: '2024 McLaren 750S',
  make: 'McLaren',
  model: '750S',
  year: 2024,
  color: 'Papaya',
  daily_rate: '1199.00', // numeric arrives as string from PostgREST
  rate_3hr: null,
  rate_6hr: null,
  rate_multiday: null,
  default_mileage_limit: 150,
  mileage_overage_rate: '3.50',
  hero_image_url: 'https://x.supabase.co/storage/v1/object/public/vehicle-photos/hero.jpg',
  photos: [
    { url: 'https://x.supabase.co/storage/a.jpg', thumbnail_url: null, display_order: 1 },
  ],
  pickup_city: 'Scottsdale',
  pickup_state: 'AZ',
  timezone: 'America/Phoenix',
  currency: 'usd',
  min_rental_days: 2,
};

describe('M4 adapters (RPC rows -> domain, dollars -> cents)', () => {
  it('converts numeric dollars (including string form) to integer cents', () => {
    expect(dollarsToCents('1199.00')).toBe(119900);
    expect(dollarsToCents(89.5)).toBe(8950);
    expect(dollarsToCents(null)).toBe(0);
    expect(dollarsToCents('not-a-number')).toBe(0);
  });

  it('adapts a team without exposing internal ids or phone numbers', () => {
    const team = adaptTeam(teamRow);
    expect(team.slug).toBe('exotiq-pilot');
    expect(team.id).toBe('team:exotiq-pilot');
    expect(team.phone).toBe('');
    expect(team.about).toBe('Pilot operator.');
  });

  it('adapts a fleet vehicle with cents money and a safe fallback footnote', () => {
    const team = adaptTeam(teamRow);
    const vehicle = adaptFleetVehicle(vehicleRow, team);
    expect(vehicle.dailyRateCents).toBe(119900);
    expect(vehicle.slug).toBe('2024-mclaren-750s');
    expect(vehicle.specs).toBeUndefined();
    expect(vehicle.minRentalDays).toBe(2);
  });

  it('prefers signed media URLs over RPC photo URLs, ordered by display_order', () => {
    const team = adaptTeam(teamRow);
    const vehicle = adaptVehicleDetail(vehicleRow, team, {
      expiresIn: 3600,
      photos: [
        { signedUrl: 'https://signed/b.jpg', thumbnailUrl: null, displayOrder: 2 },
        { signedUrl: 'https://signed/a.jpg', thumbnailUrl: null, displayOrder: 1 },
      ],
    });
    expect(vehicle.photos).toEqual(['https://signed/a.jpg', 'https://signed/b.jpg']);
    expect(vehicle.heroImage).toBe('https://signed/a.jpg');
    expect(vehicle.footnote).toContain('150 miles/day');
  });

  it('falls back to the stored RPC gallery when no signed media exists', () => {
    // 2026-08-25 photo incident: when rent-public-media fails or returns
    // nothing, the detail RPC's own photos array is the next-best source —
    // degrading straight to the single hero threw away a gallery the
    // response already contained.
    const team = adaptTeam(teamRow);
    const vehicle = adaptVehicleDetail(vehicleRow, team, { photos: [], expiresIn: 0 });
    expect(vehicle.photos).toEqual(['https://x.supabase.co/storage/a.jpg']);
    expect(vehicle.heroImage).toBe('https://x.supabase.co/storage/a.jpg');
  });

  it('falls back to the RPC hero image when there is no media and no stored gallery', () => {
    const team = adaptTeam(teamRow);
    const vehicle = adaptVehicleDetail({ ...vehicleRow, photos: null }, team, { photos: [], expiresIn: 0 });
    expect(vehicle.heroImage).toBe(vehicleRow.hero_image_url);
    expect(vehicle.photos).toEqual([vehicleRow.hero_image_url]);
  });

  it('drops non-https photo values the Command Center is known to persist', () => {
    // vehicles.image_url and vehicle_photos.url carry "/src/assets/…" and
    // "/lovable-uploads/…" filesystem paths that only the Command Center's
    // client-side filters hide. Resolved against this app's origin they 404.
    const team = adaptTeam(teamRow);
    const fleet = adaptFleetVehicle({ ...vehicleRow, hero_image_url: '/src/assets/vehicles/roma.jpg' }, team);
    expect(fleet.heroImage).toBe('');
    expect(fleet.photos).toEqual([]);

    const detail = adaptVehicleDetail(
      {
        ...vehicleRow,
        photos: [
          { url: '/lovable-uploads/abc.png', thumbnail_url: null, display_order: 1 },
          { url: 'https://x.supabase.co/storage/b.jpg', thumbnail_url: null, display_order: 2 },
        ],
      },
      team,
      { photos: [], expiresIn: 0 },
    );
    expect(detail.photos).toEqual(['https://x.supabase.co/storage/b.jpg']);
  });

  it('maps busy ranges straight through as unavailable ISO date ranges', () => {
    expect(adaptBusyRanges([{ busy_start: '2026-07-24', busy_end: '2026-07-28' }])).toEqual([
      { start: '2026-07-24', end: '2026-07-28' },
    ]);
  });

  it('adapts the server quote (already cents) and derives the fee rate', () => {
    const quoteRow: RpcQuoteRow = {
      currency: 'usd',
      rental_days: 3,
      daily_rate_cents: 199900,
      rental_subtotal_cents: 599700,
      operator_total_cents: 599700,
      platform_fee_percent: '10',
      platform_fee_cents: 59970,
      protection_tier: 'premium',
      protection_daily_cents: 28900,
      protection_total_cents: 86700,
      exotiq_total_cents: 146670,
      grand_total_cents: 746370,
    };
    const quote = adaptQuote(quoteRow);
    // The D1/D9/D5 sample: 3 days x $1,999 = $7,463.70 all-in.
    expect(quote.grandTotalCents).toBe(746370);
    expect(quote.platformFeeRate).toBeCloseTo(0.1);
    expect(quote.platformFeeCents).toBe(59970);
    expect(quote.protectionTotalCents).toBe(86700);
    // No deposit_cents in the row → nothing held, nothing stripped.
    expect(quote.depositHoldCents).toBe(0);
    expect(quote.operatorTaxesCents).toBe(0);
  });

  it('passes the backend totals through untouched — the deposit is excluded server-side (2026-07-26 decision)', () => {
    // Real production shape, read off public_vehicle_quote for the Bugatti:
    // the backend no longer rolls the deposit into operator_total/grand_total
    // and returns deposit_cents = 0. Verified before the adapter's subtraction
    // was removed. Replaces the old "strips the deposit out" test, which pinned
    // arithmetic that would now double-subtract.
    const quoteRow: RpcQuoteRow = {
      currency: 'usd',
      rental_days: 3,
      daily_rate_cents: 500000,
      rental_subtotal_cents: 1500000,
      deposit_cents: 0,
      operator_total_cents: 1500000,
      platform_fee_percent: 10,
      platform_fee_cents: 150000,
      protection_tier: 'premium',
      protection_daily_cents: 28900,
      protection_total_cents: 86700,
      exotiq_total_cents: 236700,
      grand_total_cents: 1736700,
    };
    const quote = adaptQuote(quoteRow);
    expect(quote.operatorTotalCents).toBe(1500000);
    expect(quote.operatorTaxesCents).toBe(0);
    expect(quote.grandTotalCents).toBe(1736700);
    expect(quote.depositHoldCents).toBe(0);
  });

  it('exposes every component of exotiqTotalCents so the itemisation can add up', () => {
    // Production regression, 2026-07-28: the backend added processing and state
    // fees INTO exotiq_total_cents. The UI itemised only Trip Fees + protection,
    // so a $1,842 section showed rows summing to $1,578 and $264 of the renter's
    // money went unexplained. Adapting the fields is what makes the rows able to
    // reconcile; this pins that they are carried and NOT re-added to the total.
    const quote = adaptQuote({
      currency: 'usd',
      rental_days: 2,
      daily_rate_cents: 500000,
      rental_subtotal_cents: 1000000,
      deposit_cents: 0,
      operator_total_cents: 1000000,
      platform_fee_percent: 10,
      platform_fee_cents: 100000,
      protection_tier: 'premium',
      protection_daily_cents: 28900,
      protection_total_cents: 57800,
      processing_fee_cents: 25220,
      state_fee_cents: 1178,
      exotiq_total_cents: 184198,
      grand_total_cents: 1184198,
    });
    expect(quote.processingFeeCents).toBe(25220);
    expect(quote.stateFeeCents).toBe(1178);
    // The four itemised rows reconcile exactly to the section total.
    expect(
      quote.platformFeeCents + quote.protectionTotalCents + quote.stateFeeCents + quote.processingFeeCents,
    ).toBe(quote.exotiqTotalCents);
    // And the server total is passed through, never recomputed.
    expect(quote.grandTotalCents).toBe(1184198);
  });

  it('defaults the new fee columns to 0 when an older quote omits them', () => {
    const quote = adaptQuote({
      currency: 'usd', rental_days: 1, daily_rate_cents: 100000,
      rental_subtotal_cents: 100000, deposit_cents: 0, operator_total_cents: 100000,
      platform_fee_percent: 10, platform_fee_cents: 10000, protection_tier: 'premium',
      protection_daily_cents: 28900, protection_total_cents: 28900,
      exotiq_total_cents: 38900, grand_total_cents: 138900,
    });
    expect(quote.processingFeeCents).toBe(0);
    expect(quote.stateFeeCents).toBe(0);
  });

  it('never subtracts a non-zero deposit_cents from the totals', () => {
    // Guard against a regression to the old behaviour. If the backend ever
    // returns a non-zero deposit again, it must surface on depositHoldCents and
    // leave the charge lines alone — silently reducing a total the renter is
    // asked to pay is the worse failure of the two.
    const quote = adaptQuote({
      currency: 'usd',
      rental_days: 1,
      daily_rate_cents: 100000,
      rental_subtotal_cents: 100000,
      deposit_cents: 250000,
      operator_total_cents: 100000,
      platform_fee_percent: 10,
      platform_fee_cents: 10000,
      protection_tier: 'standard',
      protection_daily_cents: 8900,
      protection_total_cents: 8900,
      exotiq_total_cents: 18900,
      grand_total_cents: 118900,
    });
    expect(quote.operatorTotalCents).toBe(100000);
    expect(quote.grandTotalCents).toBe(118900);
    expect(quote.depositHoldCents).toBe(250000);
  });
});
