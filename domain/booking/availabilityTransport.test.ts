import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./config', async (original) => ({ ...await original<typeof import('./config')>(), getSupabaseUrl: () => 'https://synthetic.invalid', getFunctionsBaseUrl: () => 'https://synthetic.invalid/functions/v1', getSupabaseAnonKey: () => 'synthetic-public-key' }));
import { getSupabaseVehicleContext } from './supabaseService';
const signals: AbortSignal[] = [];
const row = { team_slug: 'transport-test', team_name: 'Synthetic', vehicle_slug: 'car', name: 'Car', make: 'Synthetic', model: 'Car', year: 2030, daily_rate: 100, min_rental_days: 2, photos: [] };
beforeEach(() => { vi.useFakeTimers(); signals.length = 0; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('actual context transport timeout', () => {
  it.each(['public_team_by_slug', 'public_vehicle_by_slug'])('bounds and aborts a hung %s context lookup too', async (hung) => {
    vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith(`/${hung}`)) {
        const signal = init.signal!; signals.push(signal);
        return new Promise((_, reject) => { signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true }); });
      }
      return Promise.resolve(new Response(JSON.stringify(url.endsWith('/public_team_by_slug') ? [{ slug: 'transport-test', name: 'Synthetic', timezone: 'UTC' }] : [row])));
    }));
    let settled = false;
    const pending = getSupabaseVehicleContext('transport-test', 'car').then(() => { settled = true; }, () => { settled = true; });
    await vi.advanceTimersByTimeAsync(5001);
    expect(settled).toBe(true); expect(signals[0]?.aborted).toBe(true);
    await pending; expect(vi.getTimerCount()).toBe(0);
  });
  it('aborts fetch for hung availability and signing, returning UNKNOWN without fallback ranges', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith('/public_team_by_slug')) return Promise.resolve(new Response(JSON.stringify([{ slug: 'transport-test', name: 'Synthetic', timezone: 'UTC' }])));
      if (url.endsWith('/public_vehicle_by_slug')) return Promise.resolve(new Response(JSON.stringify([row])));
      const signal = init.signal!; signals.push(signal);
      return new Promise((_, reject) => { signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true }); });
    }));
    const pending = getSupabaseVehicleContext('transport-test', 'car');
    await vi.advanceTimersByTimeAsync(5001);
    const context = await pending;
    expect(signals).toHaveLength(2); expect(signals.every((signal) => signal?.aborted)).toBe(true);
    expect(context?.availabilityAuthority).toMatchObject({ status: 'UNKNOWN', reason: 'upstream_unavailable' });
    expect(context?.vehicle.unavailableRanges).toBeUndefined(); expect(vi.getTimerCount()).toBe(0);
  });
});
