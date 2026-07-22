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

  it('falls back to the RPC hero image when no signed media exists', () => {
    const team = adaptTeam(teamRow);
    const vehicle = adaptVehicleDetail(vehicleRow, team, { photos: [], expiresIn: 0 });
    expect(vehicle.heroImage).toBe(vehicleRow.hero_image_url);
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
  });
});
