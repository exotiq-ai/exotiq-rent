// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecoveryPage from '@/app/agent/authorization/[renewalId]/page';
import AccountPage from '@/app/agent/account/[operatorId]/page';
import { eligibleRoute } from '@/components/analytics/policy';
const renewalId = '10000000-0000-4000-8000-000000000004', operatorId = '10000000-0000-4000-8000-000000000002';
const now = new Date('2030-01-01T12:00:00Z');
let root: Root, host: HTMLDivElement, session: any, data: any, posted: { path: string; body: any }[];
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
function props(element: Element): any { return (element as any)[Object.keys(element).find((key) => key.startsWith('__reactProps$'))!]; }
const button = (text: string) => Array.from(host.querySelectorAll('button')).find((b) => b.textContent === text)!;
const mount = (page: any, params: any) => act(async () => root.render(createElement(page, { params })));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); posted = [];
  session = { authenticated: true, csrf: 'synthetic-csrf', expires_at: '2030-01-01T12:10:00Z', profile: { email: 'verified@example.invalid', emailVerified: true, name: 'Synthetic Customer' } };
  data = { api_version: 'v1', source_checked_at: now.toISOString(), renewal_id: renewalId, ref: 'SYNTHETIC-REQUEST', operator_id: operatorId, operator_name: 'Synthetic Tampa operator', vehicle_name: 'Synthetic car', agent_client_id: 'synthetic-agent-client', action_scopes: ['rental_requests:read', 'checkout:handoff'], expires_at: '2030-01-01T12:10:00Z', state: 'authorization_required', requires_new_delegation: false, pickup_at: '2030-01-10T10:00:00-05:00', return_at: '2030-01-12T10:00:00-05:00', timezone: 'America/New_York', status: 'pending_payment', hold_expires_at: '2030-01-04T12:00:00Z', payment_due_at: '2030-01-03T12:00:00Z' };
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/agent/auth/session') return json(session, session.authenticated ? 200 : 401);
    if (path === `/api/agent/customer/grant-renewals/${renewalId}`) return json(data);
    posted.push({ path, body: JSON.parse(init!.body as string) });
    if (path.endsWith('/review')) return json(data);
    if (path.endsWith('/complete')) return json({ ...data, state: 'authorized' });
    if (path === '/api/agent/customer/customers/operator-links') return json({ api_version: 'v1', source_checked_at: now.toISOString(), operator_id: operatorId, state: 'linked' }, 201);
    throw Error('Offline tests forbid unowned network URL');
  }));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('actual hosted grant recovery and customer account linking', () => {
  it.each([25, 71])('after %ih delegates only existing status/payment scopes with unchanged request and deadlines', async (hours) => {
    // Long-lived booking hold is distinct from the fresh ten-minute customer
    // browser session. No refresh token or old session is trusted by the UI.
    data.source_checked_at = new Date(now.getTime() - hours * 3600000).toISOString();
    await mount(RecoveryPage, { renewalId });
    for (const text of ['SYNTHETIC-REQUEST', 'Synthetic Tampa operator', 'pending_payment', '2030-01-04T12:00:00Z', '2030-01-03T12:00:00Z']) expect(host.textContent).toContain(text);
    const callback = props(button('Reauthorize agent access')).onClick;
    await act(async () => { callback(); callback(); });
    expect(posted.filter((p) => p.path.endsWith('/review'))).toHaveLength(1);
    expect(posted.filter((p) => p.path.endsWith('/complete'))).toHaveLength(1);
    expect(posted.find((p) => p.path.endsWith('/complete'))?.body).toEqual({ csrf: 'synthetic-csrf', action_scopes: ['rental_requests:read', 'checkout:handoff'], explicit_new_delegation: false, consented: true });
    expect(posted.every((p) => !/rental-requests|checkout-handoffs/.test(p.path))).toBe(true);
  });
  it('revoked access requires a different explicit new-delegation button; old access is never silently revived', async () => {
    data.requires_new_delegation = true; await mount(RecoveryPage, { renewalId });
    expect(button('Reauthorize agent access')).toBeUndefined(); expect(host.textContent).toMatch(/revoked/i);
    await act(async () => props(button('Authorize new agent access')).onClick());
    expect(posted.find((p) => p.path.endsWith('/complete'))?.body.explicit_new_delegation).toBe(true);
  });
  it('expired browser session requires fresh sign-in before viewing/reviewing recovery', async () => {
    session.expires_at = '2029-12-31T12:00:00Z'; await mount(RecoveryPage, { renewalId });
    expect(host.querySelector('a')?.getAttribute('href')).toContain('/api/agent/auth/start?return_to='); expect(posted).toHaveLength(0);
    expect(host.textContent).not.toContain('SYNTHETIC-REQUEST');
  });
  it('rejects elevated or malformed scopes rather than silently requesting them', async () => {
    data.action_scopes.push('rental_requests:create'); await mount(RecoveryPage, { renewalId });
    expect(button('Reauthorize agent access')).toBeUndefined(); expect(posted).toHaveLength(0);
  });
  it('links an operator customer only on an explicit click and sends no typed email authorization', async () => {
    await mount(AccountPage, { operatorId }); expect(posted).toHaveLength(0);
    expect(host.textContent).toContain('verified@example.invalid');
    const input = host.querySelector<HTMLInputElement>('input[name="phone"]')!;
    await act(async () => props(input).onChange({ target: { value: '+13055550100' } }));
    const callback = props(button('Link my customer account')).onClick;
    await act(async () => { callback(); callback(); }); expect(posted).toHaveLength(1);
    expect(posted[0].body).toEqual({ csrf: 'synthetic-csrf', operator_id: operatorId, full_name: 'Synthetic Customer', phone: '+13055550100', consented: true });
    expect(host.textContent).toMatch(/linked/i); expect(JSON.stringify(posted)).not.toMatch(/email_verified|access_token|consent_receipt/);
  });
  it.each([false, null])('missing verified provider email disables linking, regardless of display-name fields', async (verified) => {
    session.profile.emailVerified = verified === true; if (verified === null) session.profile.email = null;
    await mount(AccountPage, { operatorId }); expect(button('Link my customer account')?.disabled ?? true).toBe(true);
    expect(host.textContent).toMatch(/verified email/i); expect(posted).toHaveLength(0);
  });
  it('all agent customer routes are excluded from analytics eligibility', () => {
    for (const path of ['/agent', '/agent/account', `/agent/account/${operatorId}`, `/agent/consent/${renewalId}`, `/agent/authorization/${renewalId}`]) expect(eligibleRoute(path)).toBe(false);
  });
});
