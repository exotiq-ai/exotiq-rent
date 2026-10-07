// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConsentPage from '@/app/agent/consent/[quoteId]/page';
import { parseQuoteReview } from './externalContracts';
const quoteId = '10000000-0000-4000-8000-000000000001';
const operatorId = '10000000-0000-4000-8000-000000000002';
const now = new Date('2030-01-01T12:00:00Z');
const review = () => ({ operator_name: 'Synthetic Miami operator', vehicle_name: 'Synthetic touring car', quote: {
  api_version: 'v1', source_checked_at: now.toISOString(), operator_id: operatorId, vehicle_id: '10000000-0000-4000-8000-000000000003', quote_id: quoteId,
  pickup_at: '2030-01-10T10:00:00-05:00', return_at: '2030-01-12T10:00:00-05:00', timezone: 'America/New_York', principal_scope: { subject: 'synthetic-subject', operator_id: operatorId }, expires_at: '2030-01-01T12:10:00Z', pricing_version: 'price-v1', terms_version: 'terms-v1', terms_hash: 'a'.repeat(64), selected_options: ['decline'],
  terms: { cancellation_policy: 'Synthetic cancellation policy', pickup_address: 'Synthetic pickup address', pickup_instructions: 'Meet the operator at pickup.', mileage_limit: 100, mileage_overage_rate_usd: '2.5', deposit_disclosure: 'Deposit collected separately at pickup.' },
  pricing_details: { rental_days: 2, daily_rate_cents: 10000, protection_tier: 'decline', protection_daily_cents: 0, state_code: 'FL', state_fee_label: 'Florida rental fee', state_fee_daily_cents: 200, operator_tax_label: 'Operator tax', operator_tax_rate_percent: '5', platform_fee_percent: '10' }, currency: 'USD',
  itemization: { rental_subtotal_cents: 20000, operator_tax_cents: 1000, operator_tax_inclusive: false, platform_fee_cents: 2000, protection_total_cents: 0, state_fee_cents: 400, processing_fee_cents: 500, deposit_cents: 50000 }, operator_total_cents: 21000, exotiq_total_cents: 2900, total_cents: 23900,
  payment_schedule: [{ payee: 'operator', amount_cents: 21000, due: 'after_operator_approval' }, { payee: 'exotiq', amount_cents: 2900, due: 'after_operator_charge' }], availability_checked_at: now.toISOString(), holds_inventory: false, consent_url: `https://synthetic.invalid/agent/consent/${quoteId}`,
} });
let root: Root, host: HTMLDivElement;
let session: any, data: any, posted: { url: string; body: any }[];
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
function props(element: Element): any { return (element as any)[Object.keys(element).find((key) => key.startsWith('__reactProps$'))!]; }
const authorize = () => Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Authorize rental request')!;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  session = { authenticated: true, csrf: 'synthetic-csrf', expires_at: '2030-01-01T12:10:00Z', profile: { email: 'customer@example.invalid', emailVerified: true, name: 'Synthetic customer' } };
  data = review(); posted = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/agent/auth/session') return json(session, session.authenticated ? 200 : 401);
    if (url === `/api/agent/customer/quotes/${quoteId}`) return json(data);
    if (url === `/api/agent/customer/quotes/${quoteId}/consents`) { posted.push({ url, body: JSON.parse(init!.body as string) }); return json({ api_version: 'v1', source_checked_at: now.toISOString(), quote_id: quoteId, state: 'authorized', expires_at: '2030-01-01T12:10:00Z' }, 201); }
    throw Error('Offline test forbids unowned network URL');
  }));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const mount = () => act(async () => root.render(createElement(ConsentPage, { params: { quoteId } })));
describe('actual hosted customer quote review', () => {
  it('shows all authoritative terms and charge legs, then posts explicit quote-bound consent without a receipt', async () => {
    await mount();
    for (const text of ['Synthetic Miami operator', 'Synthetic touring car', 'America/New_York', 'Synthetic cancellation policy', 'Synthetic pickup address', '100', 'Florida rental fee', '$239.00', '$500.00', 'operator approval', 'customer']) expect(host.textContent).toContain(text);
    const callback = props(authorize()).onClick;
    await act(async () => { callback(); callback(); });
    expect(posted).toHaveLength(1); expect(posted[0].body).toEqual({ csrf: 'synthetic-csrf', terms_hash: 'a'.repeat(64), action: 'rental_requests:create' });
    expect(host.textContent).toMatch(/authorized|authorization recorded/i); expect(host.innerHTML).not.toMatch(/receipt|Bearer|access_token|synthetic-subject/);
  });
  it('requires customer sign-in and an owned return path without fetching private quotes', async () => {
    session = { authenticated: false }; await mount();
    expect(host.querySelector('a')?.getAttribute('href')).toBe(`/api/agent/auth/start?return_to=${encodeURIComponent(`/agent/consent/${quoteId}`)}`);
    expect(host.querySelectorAll('button')).toHaveLength(0); expect(posted).toHaveLength(0);
    expect(vi.mocked(fetch).mock.calls.map((c) => c[0])).toEqual(['/api/agent/auth/session']);
  });
  it.each(['partial', 'UNKNOWN', 'wrong-quote', 'incorrect-money'] as const)('fails closed on %s authority response', async (kind) => {
    if (kind === 'partial') delete data.quote.terms;
    if (kind === 'UNKNOWN') data.quote.availability = 'UNKNOWN';
    if (kind === 'wrong-quote') data.quote.quote_id = operatorId;
    if (kind === 'incorrect-money') data.quote.total_cents++;
    await mount(); expect(authorize()).toBeUndefined(); expect(posted).toHaveLength(0); expect(host.textContent).toMatch(/confirm|unavailable|review/i);
  });
  it('checks expiration again inside a captured handler and never silently reprices', async () => {
    await mount(); const callback = props(authorize()).onClick;
    vi.setSystemTime('2030-01-01T12:10:01Z'); await act(async () => callback());
    expect(posted).toHaveLength(0); expect(host.textContent).toMatch(/expired|sign in/i);
  });
  it('runtime validator rejects arithmetic or missing disclosure instead of trusting a typed cast', () => {
    expect(parseQuoteReview(review(), quoteId, now.getTime()).quote.quote_id).toBe(quoteId);
    const invalid = review(); invalid.quote.payment_schedule[0].amount_cents++;
    expect(() => parseQuoteReview(invalid, quoteId, now.getTime())).toThrow();
  });
});
