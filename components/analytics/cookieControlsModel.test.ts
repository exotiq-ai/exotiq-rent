import { describe, expect, it } from 'vitest';
import { cookieControlsVisibility, cookieControlState, toggleOptionalCookies } from './cookieControlsModel';
import { DENIED, type TrackingEnvironment } from './policy';

const environment: TrackingEnvironment = { enabled: 'true', dataMode: 'supabase', posthogKey: 'phc_publicTest123', metaPixelId: '1603562574756003' };
const location = (path = '/exotiq', hostname = 'book.exotiq.rent', referrer = '') => ({ hostname, pathname: path.split(/[?#]/)[0], href: `https://${hostname}${path}`, referrer });
const input = { environment, location: location(), ready: true, hasSavedChoice: false };

describe('compact cookie controls visibility', () => {
  it.each(['/exotiq', '/exotiq/', '/exotiq/huracan', '/exotiq/huracan/book?start=2026-10-01&end=2026-10-04'])('offers the row on an eligible public route: %s', path => {
    expect(cookieControlsVisibility({ ...input, location: location(path) })).toBe('row');
  });
  it.each(['/ark', '/ark/mclaren-gt', '/ark/mclaren-gt/book', '/privacy', '/terms', '/booking/private', '/verify', '/saved', '/browse', '/exotiq/huracan/private'])('does not prompt a new visitor on %s', path => {
    expect(cookieControlsVisibility({ ...input, location: location(path) })).toBe('hidden');
  });
  it.each(['localhost', 'demo.exotiq.rent', 'exotiq.rent', 'preview.netlify.app'])('does not prompt on %s', host => {
    expect(cookieControlsVisibility({ ...input, location: location('/exotiq', host) })).toBe('hidden');
  });
  it.each([
    { enabled: 'false' }, { enabled: undefined }, { dataMode: 'demo' },
    { posthogKey: '', metaPixelId: '' }, { posthogKey: 'private_key', metaPixelId: 'invalid' },
    { posthogHost: 'https://untrusted.example', metaPixelId: '' },
  ])('requires enabled production data and a valid provider: %j', overrides => {
    expect(cookieControlsVisibility({ ...input, environment: { ...environment, ...overrides } })).toBe('hidden');
  });
  it.each([{ posthogKey: '' }, { metaPixelId: '' }])('permits a single valid provider: %j', overrides => {
    expect(cookieControlsVisibility({ ...input, environment: { ...environment, ...overrides } })).toBe('row');
  });
  it.each(['/exotiq?token=secret', '/exotiq?t=secret', '/exotiq?r=secret', '/exotiq#secret'])('hides the row on credential-bearing URLs: %s', path => {
    expect(cookieControlsVisibility({ ...input, location: location(path) })).toBe('hidden');
  });
  it('matches the runtime credential-bearing referrer exclusion', () => {
    expect(cookieControlsVisibility({ ...input, location: location('/exotiq', 'book.exotiq.rent', 'https://book.exotiq.rent/booking/id?t=secret') })).toBe('hidden');
  });
  it('does not flash a prompt before hydration has established eligibility', () => {
    expect(cookieControlsVisibility({ ...input, ready: false })).toBe('hidden');
  });
  it('keeps the compact row for an existing eligible choice', () => {
    expect(cookieControlsVisibility({ ...input, hasSavedChoice: true })).toBe('row');
  });
  it.each(['/privacy', '/ark', '/booking/private', '/exotiq?token=secret'])('allows only discreet saved preferences outside eligible tracking: %s', path => {
    expect(cookieControlsVisibility({ ...input, hasSavedChoice: true, location: location(path) })).toBe('preferences');
  });
  it('allows an explicit manual entry even without tracking, consent, or hydration', () => {
    expect(cookieControlsVisibility({ ...input, ready: false, environment: {}, location: location('/privacy'), manual: true })).toBe('preferences');
  });
});

describe('compact cookie controls state', () => {
  it.each([
    [false, false, 'Off', false], [true, true, 'On', true],
    [true, false, 'Custom', 'mixed'], [false, true, 'Custom', 'mixed'],
  ] as const)('represents analytics=%s advertising=%s as %s', (analytics, marketing, label, checked) => {
    expect(cookieControlState({ analytics, marketing }, false)).toEqual({ label, checked });
  });
  it('represents GPC-effective consent, not a stale advertising grant', () => {
    expect(cookieControlState({ analytics: true, marketing: true }, true)).toEqual({ label: 'Custom', checked: 'mixed' });
    expect(cookieControlState({ analytics: false, marketing: true }, true)).toEqual({ label: 'Off', checked: false });
  });
  it('enables both only through an explicit master toggle from Off', () => {
    expect(toggleOptionalCookies(DENIED, false)).toEqual({ analytics: true, marketing: true });
    expect(DENIED).toEqual({ analytics: false, marketing: false });
  });
  it.each([{ analytics: true, marketing: true }, { analytics: true, marketing: false }, { analytics: false, marketing: true }])('switches On or Custom fully off instead of broadening a choice: %j', choice => {
    expect(toggleOptionalCookies(choice, false)).toEqual(DENIED);
  });
  it('never grants advertising under GPC', () => {
    expect(toggleOptionalCookies(DENIED, true)).toEqual({ analytics: true, marketing: false });
    expect(toggleOptionalCookies({ analytics: true, marketing: true }, true)).toEqual(DENIED);
    expect(toggleOptionalCookies({ analytics: false, marketing: true }, true)).toEqual({ analytics: true, marketing: false });
  });
});
