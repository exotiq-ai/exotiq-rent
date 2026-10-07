// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const wire = vi.hoisted(() => ({ team: vi.fn(), vehicle: vi.fn(), media: vi.fn(), availability: vi.fn(), create: vi.fn(), quote: vi.fn() }));
vi.mock('@/domain/booking/config', async (original) => ({ ...await original<typeof import('@/domain/booking/config')>(), getDataMode: () => 'supabase' }));
vi.mock('@/domain/booking/rpcClient', async (original) => ({ ...await original<typeof import('@/domain/booking/rpcClient')>(), fetchPublicTeam: wire.team, fetchPublicVehicle: wire.vehicle, fetchSignedVehicleMedia: wire.media, fetchVehicleAvailability: wire.availability, postCreateBooking: wire.create }));
vi.mock('@/domain/booking/quote', async (original) => ({ ...await original<typeof import('@/domain/booking/quote')>(), loadQuote: wire.quote }));
vi.mock('@/components/drive-exotiq/fonts', () => ({ driveFontClassName: 'test-font' }));
vi.mock('@/components/analytics/CookieControls', () => ({ CookieControls: () => null }));
vi.mock('@/components/analytics/posthog', () => ({ track: vi.fn() }));
vi.mock('@/components/renters/bookingCapture', () => ({ captureBooking: vi.fn() }));
vi.mock('next/image', () => ({ default: () => null }));
import { BookingFlow } from '../BookingFlow';
import { createBookingCart, createRenterBooking, getBookingStartContext } from '@/domain/booking/service';
import type { PublicVehicleContext } from '@/domain/booking/publicContracts';
import type { Vehicle } from '@/domain/booking/types';

const now = new Date('2030-01-01T12:00:00Z');
const team = { slug: 'flow-test-team', name: 'Synthetic operator', logo_url: null, city: 'Miami', state: 'FL', timezone: 'America/New_York' };
const raw = { team_slug: team.slug, team_name: team.name, vehicle_slug: 'flow-test-car', name: 'Synthetic car', make: 'Synthetic', model: 'Car', year: 2030, color: null, daily_rate: '100.25', hero_image_url: null, min_rental_days: 2, rate_3hr: null, rate_6hr: null, rate_multiday: null, default_mileage_limit: 100, mileage_overage_rate: 2, photos: null, pickup_city: 'Miami', pickup_state: 'FL', timezone: 'America/New_York', currency: 'usd' };
let root: Root;
let host: HTMLDivElement;
let context: PublicVehicleContext;
function props(element: Element): any { const key = Object.keys(element).find((k) => k.startsWith('__reactProps$')); return (element as any)[key!]; }
const button = (text: string) => Array.from(host.querySelectorAll('button')).find((b) => b.textContent === text)!;
async function render(vehicle = context.vehicle, dates?: { start: string; end: string }) { await act(async () => root.render(<BookingFlow operator={context.team} vehicle={vehicle} initialDates={dates} />)); }
async function invoke(text: string) { await act(async () => props(button(text)).onClick()); }
async function enterReview() {
  await invoke('Continue');
  expect(host.textContent).toContain("Who's driving?");
  // Invoke the real mounted form's onChange handlers, preserving its validation,
  // cart state, and step transitions (no mocked DriverStep or business helpers).
  for (const [selector, value] of [['input[autocomplete="name"]', 'Synthetic Driver'], ['input[autocomplete="bday"]', '01/01/1990'], ['input[autocomplete="tel"]', '+13055550100'], ['input[autocomplete="email"]', 'driver@example.invalid']] as const) {
    const input = host.querySelector<HTMLInputElement>(selector)!;
    await act(async () => props(input).onChange({ target: { value }, currentTarget: input }));
  }
  await invoke('Continue');
  expect(host.textContent).toContain("Here's the breakdown.");
}
beforeEach(async () => {
  vi.resetAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn(() => { throw Error('Offline network denied'); }));
  wire.team.mockResolvedValue(team); wire.vehicle.mockResolvedValue(raw); wire.media.mockResolvedValue({ photos: [], expiresIn: 0 }); wire.availability.mockResolvedValue([]);
  wire.quote.mockImplementation(async (cart) => ({ ...cart.totals, rentalDays: cart.totals.days, dailyRateCents: cart.vehicle.dailyRateCents }));
  wire.create.mockRejectedValue(Error('Synthetic request failure: stay on page'));
  context = (await getBookingStartContext(team.slug, raw.vehicle_slug))!;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('mounted storefront plus actual context/cart/create facade', () => {
  it.each(['missing', 'UNKNOWN', 'stale'] as const)('blocks %s authority, seeded dates, and direct Continue with zero quote/request calls', async (kind) => {
    const vehicle: Vehicle = { ...context.vehicle, availabilityAuthority: kind === 'missing' ? undefined : kind === 'UNKNOWN' ? { status: 'UNKNOWN', reason: 'upstream_unavailable', retryAfterSeconds: 30 } : { status: 'KNOWN', checkedAt: '2029-12-01T12:00:00Z', windowStart: '2030-01-01', windowEnd: '2030-07-01' } };
    await render(vehicle, { start: '2030-01-10', end: '2030-01-14' });
    expect(button('Continue').disabled).toBe(true);
    await invoke('Continue'); expect(host.textContent).toContain('When are you driving?');
    await expect(createRenterBooking(createBookingCart({ operator: context.team, vehicle }))).rejects.toMatchObject({ code: 'availability_unknown' });
    expect(wire.quote).not.toHaveBeenCalled(); expect(wire.create).not.toHaveBeenCalled();
  });
  it('ready quote cannot authorize a captured request after source authority becomes UNKNOWN', async () => {
    await render(); await enterReview(); expect(wire.quote).toHaveBeenCalledOnce();
    await act(async () => host.querySelector<HTMLInputElement>('#review-terms')!.click());
    const request = props(button('Request this booking')).onClick;
    expect(button('Request this booking').disabled).toBe(false);
    await render({ ...context.vehicle, availabilityAuthority: { status: 'UNKNOWN', reason: 'upstream_unavailable', retryAfterSeconds: 30 }, unavailableRanges: undefined });
    expect(button('Request this booking').disabled).toBe(true);
    await act(async () => request()); await invoke('Request this booking');
    expect(wire.quote).toHaveBeenCalledOnce(); expect(wire.create).not.toHaveBeenCalled();
  });
  it('checks the current changed window on retry; failed and blocked checks never restore Continue', async () => {
    context = { ...context, vehicle: { ...context.vehicle, availabilityAuthority: { status: 'KNOWN', checkedAt: now.toISOString(), windowStart: '2030-01-01', windowEnd: '2030-01-04' } } };
    await render();
    const day = host.querySelector<HTMLButtonElement>('button[aria-label^="Thursday, January 10"]')!;
    await act(async () => day.click()); expect(button('Continue').disabled).toBe(true);
    wire.availability.mockRejectedValueOnce(Error('private upstream failure'));
    await invoke('Check availability'); expect(button('Continue').disabled).toBe(true); expect(host.textContent).not.toContain('private upstream');
    expect(wire.availability).toHaveBeenLastCalledWith(team.slug, raw.vehicle_slug, '2030-01-10', '2030-01-12');
    wire.availability.mockResolvedValueOnce([{ busy_start: '2030-01-10', busy_end: '2030-01-12' }]);
    await invoke('Check availability'); expect(button('Continue').disabled).toBe(true);
    wire.availability.mockResolvedValueOnce([]); await invoke('Check availability'); expect(button('Continue').disabled).toBe(false);
    await invoke('Continue'); expect(host.textContent).toContain("Who's driving?");
    expect(wire.quote).not.toHaveBeenCalled(); expect(wire.create).not.toHaveBeenCalled();
  });
  it('ignores a late ready quote after failed retry and obtains a new quote only after fresh known-empty authority', async () => {
    let resolveQuote!: (value: any) => void;
    wire.quote.mockImplementationOnce(() => new Promise((resolve) => { resolveQuote = resolve; }));
    await render(); await enterReview();
    await render({ ...context.vehicle, availabilityAuthority: { status: 'UNKNOWN', reason: 'upstream_unavailable', retryAfterSeconds: 30 } });
    wire.availability.mockRejectedValueOnce(Error('synthetic unavailable')); await invoke('Check availability');
    await act(async () => resolveQuote({ ...createBookingCart().totals, rentalDays: 2, dailyRateCents: 10025 }));
    expect(button('Request this booking').disabled).toBe(true); await invoke('Request this booking'); expect(wire.create).not.toHaveBeenCalled();
    vi.setSystemTime(now.getTime() + 1000); await invoke('Check availability');
    expect(wire.quote).toHaveBeenCalledTimes(2); expect(host.querySelector('#review-terms')).not.toBeNull();
  });
  it('expires ready evidence and rejects a previously captured request without waiting for a render', async () => {
    await render(); await enterReview(); await act(async () => host.querySelector<HTMLInputElement>('#review-terms')!.click());
    const request = props(button('Request this booking')).onClick;
    vi.setSystemTime(now.getTime() + 300001); await act(async () => request()); expect(wire.create).not.toHaveBeenCalled();
    await render(); expect(button('Request this booking').disabled).toBe(true); expect(wire.quote).toHaveBeenCalledOnce();
  });
  it('allows one known-empty request and synchronously rejects two direct request calls before React renders', async () => {
    await render(); await enterReview(); await act(async () => host.querySelector<HTMLInputElement>('#review-terms')!.click());
    const request = props(button('Request this booking')).onClick;
    await act(async () => { request(); request(); });
    expect(wire.create).toHaveBeenCalledOnce(); expect(host.textContent).toContain('Synthetic request failure');
  });
});
