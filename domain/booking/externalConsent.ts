import { ownedUuid, parseCustomerSession, parseQuoteReview, type CustomerSession, type QuoteReview } from './externalContracts';
import { validateContract } from './externalContracts.generated';
export class CustomerRequestError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
export const CUSTOMER_ACTION_SCOPES=['rental_requests:read','checkout:handoff','identity:handoff'] as const;
export type CustomerActionScope=typeof CUSTOMER_ACTION_SCOPES[number];
export const customerActionLabels:Record<CustomerActionScope,string>={
 'rental_requests:read':'Read this rental request’s status',
 'checkout:handoff':'Open customer-hosted checkout for this rental',
 'identity:handoff':'Open customer-hosted identity verification for this rental',
};
export function customerSignInPath(kind: 'consent' | 'authorization' | 'account', id: string): string {
  if (!ownedUuid(id)) throw Error('Invalid customer request.');
  return `/api/agent/auth/start?return_to=${encodeURIComponent(`/agent/${kind}/${id}`)}`;
}
export async function customerFetch(path: string, body?: Record<string, unknown>, expectedStatus?: number): Promise<unknown> {
  if (!/^\/api\/agent\/(?:auth\/session|customer\/[A-Za-z0-9/-]+)$/.test(path)) throw Error('Invalid customer request.');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(path, { method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: controller.signal, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    if (response.status === 204) {
      if (expectedStatus !== undefined && expectedStatus !== 204) throw Error('Unexpected customer response');
      return null;
    }
    const value = await response.json();
    if (!response.ok) {
      const code = value && typeof value.code === 'string' ? value.code : 'upstream_unavailable';
      throw new CustomerRequestError(code, ['quote_changed', 'quote_expired'].includes(code) ? 'This quote changed or expired. Ask your agent for a fresh quote and review it again.' : response.status === 401 ? 'Sign in again to continue.' : 'This customer request could not be confirmed. Sign in again or retry.');
    }
    if (expectedStatus !== undefined && response.status !== expectedStatus) throw Error('Unexpected customer response');
    return value;
  } catch (error) { if (error instanceof CustomerRequestError) throw error; throw new CustomerRequestError('upstream_unavailable', 'This customer request could not be confirmed. Please retry.'); }
  finally { clearTimeout(timeout); }
}
export async function readCustomerSession(): Promise<CustomerSession | null> {
  try { return parseCustomerSession(await customerFetch('/api/agent/auth/session')); }
  catch { return null; }
}
export async function readQuoteReview(quoteId: string): Promise<QuoteReview> {
  if (!ownedUuid(quoteId)) throw Error('Invalid customer request.');
  return parseQuoteReview(await customerFetch(`/api/agent/customer/quotes/${quoteId}`), quoteId);
}
export function canAuthorizeQuote(review: QuoteReview, session: CustomerSession, now = Date.now()): boolean {
  return Date.parse(review.quote.expires_at) > now && Date.parse(session.expires_at) > now;
}
export function validConsentScopes(review:QuoteReview,actionScopes:readonly CustomerActionScope[]):boolean {
  return validateContract('ConsentInput',{terms_hash:review.quote.terms_hash,action:'rental_requests:create',action_scopes:actionScopes}).ok;
}
export async function authorizeQuote(review: QuoteReview, session: CustomerSession,actionScopes:readonly CustomerActionScope[]): Promise<void> {
  if (!canAuthorizeQuote(review, session)) throw new CustomerRequestError('quote_expired', 'This quote or sign-in expired. Sign in again and request a fresh quote.');
  if(!validConsentScopes(review,actionScopes))throw new CustomerRequestError('invalid_input','Choose the agent actions you authorize for this rental.');
  const result = await customerFetch(`/api/agent/customer/quotes/${review.quote.quote_id}/consents`, { csrf: session.csrf, terms_hash: review.quote.terms_hash, action: 'rental_requests:create',action_scopes:[...actionScopes] });
  if (!validateContract('CustomerConsentResult', result).ok || !result || typeof result !== 'object' || (result as any).quote_id !== review.quote.quote_id) throw new CustomerRequestError('upstream_unavailable', 'Authorization could not be confirmed. Please retry.');
}
