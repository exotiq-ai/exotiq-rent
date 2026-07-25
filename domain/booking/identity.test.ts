import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDataMode } from './config';
import { getIdentityVerificationState, startIdentityVerification } from './service';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('data mode switch', () => {
  it('defaults to mock with no environment (the demo depends on this)', () => {
    expect(getDataMode()).toBe('mock');
  });

  it('THROWS (fails loud) when supabase mode is requested but env is incomplete', () => {
    // A live deploy missing its URL/key must not silently serve mock data.
    vi.stubEnv('NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE', 'supabase');
    expect(() => getDataMode()).toThrow(/refusing to fall back to mock/);
  });

  it('enters supabase mode with the full env set', () => {
    vi.stubEnv('NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE', 'supabase');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_x');
    expect(getDataMode()).toBe('supabase');
  });

  it('enters supabase mode without a Stripe key (IDV falls back to the hosted page)', () => {
    vi.stubEnv('NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE', 'supabase');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    expect(getDataMode()).toBe('supabase');
  });
});

describe('identity verification mock facade', () => {
  it('walks a session from processing to verified like the live webhook would', async () => {
    const start = await startIdentityVerification('BK-01001');
    expect(start.sessionId).toBeTruthy();
    expect(start.status).toBe('processing');

    const early = await getIdentityVerificationState(start.sessionId);
    expect(['processing', 'verified']).toContain(early.status);

    await new Promise((resolve) => setTimeout(resolve, 1600));
    const late = await getIdentityVerificationState(start.sessionId);
    expect(late.status).toBe('verified');
  });
});
