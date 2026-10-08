import { validateContract, validateRentalWindow } from './externalContracts.generated';
import { ownedUuid, type CustomerSession } from './externalContracts';
import { customerFetch, CustomerRequestError,type CustomerActionScope } from './externalConsent';
export interface GrantReview {
  api_version: 'v1'; source_checked_at: string; renewal_id: string; ref: string; operator_id: string;
  previous_grant_id: string; grant_id_to_revoke: string; agent_client_id: string; operator_name: string; vehicle_name: string;
  pickup_at: string; return_at: string; timezone: string; status: string;
  hold_expires_at: string | null; payment_due_at: string | null;
  action_scopes: CustomerActionScope[];
  expires_at: string; state: 'authorization_required' | 'authorized'; requires_new_delegation: boolean;
}
export function parseGrantReview(value: unknown, renewalId: string): GrantReview {
  const fail = (): never => { throw Error('The existing rental authorization could not be confirmed. Sign in again or retry.'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const v = value as Record<string, unknown>;
  if (!validateContract('GrantRenewalReviewResult', value).ok || v.renewal_id !== renewalId || !ownedUuid(renewalId)) return fail();
  if (!validateRentalWindow(v as unknown as GrantReview).ok) return fail();
  return v as unknown as GrantReview;
}
export async function readGrantReview(renewalId: string): Promise<GrantReview> {
  if (!ownedUuid(renewalId)) throw Error('Invalid customer authorization.');
  return parseGrantReview(await customerFetch(`/api/agent/customer/grant-renewals/${renewalId}`), renewalId);
}
export function canRecoverGrant(review: GrantReview, session: CustomerSession, now = Date.now()): boolean {
  return review.state === 'authorization_required' && Date.parse(review.expires_at) > now && Date.parse(session.expires_at) > now;
}
export async function recoverGrant(review: GrantReview, session: CustomerSession): Promise<GrantReview> {
  if (!canRecoverGrant(review, session)) throw new CustomerRequestError('unauthorized', 'This sign-in or authorization review expired. Sign in again to continue.');
  const reviewed = parseGrantReview(await customerFetch(`/api/agent/customer/grant-renewals/${review.renewal_id}/review`, { csrf: session.csrf }), review.renewal_id);
  const unchanged = (['ref', 'previous_grant_id', 'operator_id', 'agent_client_id', 'pickup_at', 'return_at', 'timezone', 'status', 'hold_expires_at', 'payment_due_at', 'requires_new_delegation'] as const).every((key) => reviewed[key] === review[key]);
  if (!unchanged || JSON.stringify(reviewed.action_scopes) !== JSON.stringify(review.action_scopes) || !canRecoverGrant(reviewed, session)) throw new CustomerRequestError('upstream_unavailable', 'Authorization details changed. Review the existing request again.');
  const result = parseGrantReview(await customerFetch(`/api/agent/customer/grant-renewals/${review.renewal_id}/complete`, { csrf: session.csrf, action_scopes: review.action_scopes, explicit_new_delegation: review.requires_new_delegation, consented: true }), review.renewal_id);
  if (result.ref !== review.ref || result.state !== 'authorized'||result.operator_id!==review.operator_id||result.agent_client_id!==review.agent_client_id||JSON.stringify(result.action_scopes)!==JSON.stringify(review.action_scopes)) throw new CustomerRequestError('upstream_unavailable', 'Authorization could not be confirmed.');
  return result;
}
export async function revokeGrant(review: GrantReview, session: CustomerSession): Promise<void> {
  if (!ownedUuid(review.grant_id_to_revoke) || Date.parse(session.expires_at) <= Date.now()) throw Error('Sign in again before revoking access.');
  await customerFetch(`/api/agent/customer/grants/${review.grant_id_to_revoke}/revoke`, { csrf: session.csrf }, 204);
}
export async function linkOperatorCustomer(operatorId: string, session: CustomerSession, fullName: string, phone: string): Promise<void> {
  if (!ownedUuid(operatorId) || Date.parse(session.expires_at) <= Date.now() || !session.profile.emailVerified || !session.profile.email || !fullName.trim() || fullName.trim().length > 160 || !/^\+?[0-9 ()-]{7,30}$/.test(phone)) throw Error('A fresh sign-in with a verified email, your name and phone number is required.');
  const result = await customerFetch('/api/agent/customer/customers/operator-links', { csrf: session.csrf, operator_id: operatorId, full_name: fullName.trim(), phone: phone.trim(), consented: true });
  if (!validateContract('CustomerOperatorLinkResult', result).ok || !result || typeof result !== 'object' || (result as any).operator_id !== operatorId) throw Error('Customer account linking could not be confirmed.');
}
