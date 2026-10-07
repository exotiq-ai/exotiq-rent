'use client';
import { useEffect, useRef, useState } from 'react';
import { customerSignInPath, readCustomerSession } from '@/domain/booking/externalConsent';
import { ownedUuid, type CustomerSession } from '@/domain/booking/externalContracts';
import { canRecoverGrant, readGrantReview, recoverGrant, revokeGrant, type GrantReview } from '@/domain/booking/externalGrantRecovery';
const scopeLabels = { 'rental_requests:read': 'Read this existing rental request’s status', 'checkout:handoff': 'Open customer-hosted checkout for this rental' };
export default function RecoveryPage({ params }: { params: { renewalId: string } }) {
  const [session, setSession] = useState<CustomerSession | null>(null), [review, setReview] = useState<GrantReview | null>(null);
  const [loading, setLoading] = useState(true), [pending, setPending] = useState(false), [error, setError] = useState(''), [revoked, setRevoked] = useState(false);
  const [reload, setReload] = useState(0), [, tick] = useState(0); const lock = useRef(false), generation = useRef(0);
  const latest = useRef({ review, session, id: params.renewalId }); latest.current = { review, session, id: params.renewalId };
  useEffect(() => {
    const current = ++generation.current; setLoading(true); setSession(null); setReview(null); setError(''); setRevoked(false); setPending(false); lock.current = false;
    void (async () => { try {
      if (!ownedUuid(params.renewalId)) throw Error('Invalid customer authorization.');
      const signedIn = await readCustomerSession(); if (current !== generation.current) return; setSession(signedIn);
      if (signedIn) { const result = await readGrantReview(params.renewalId); if (current === generation.current) setReview(result); }
    } catch { if (current === generation.current) setError('The existing rental authorization could not be confirmed. Sign in again or retry.'); }
    finally { if (current === generation.current) setLoading(false); } })();
    const timer = setInterval(() => tick((value) => value + 1), 1000);
    return () => { ++generation.current; clearInterval(timer); };
  }, [params.renewalId, reload]);
  const mutate = async (action: 'renew' | 'revoke') => {
    if (lock.current || !review || review.renewal_id !== params.renewalId || !session || latest.current.review !== review || latest.current.session !== session || latest.current.id !== params.renewalId || revoked) return;
    if (Date.parse(session.expires_at) <= Date.now() || (action === 'renew' && !canRecoverGrant(review, session))) { setError('This review or sign-in expired. Sign in again to continue.'); return; }
    lock.current = true; setPending(true); setError(''); const current = generation.current;
    try { if (action === 'renew') { const result = await recoverGrant(review, session); if (current === generation.current) setReview(result); }
      else { await revokeGrant(review, session); if (current === generation.current) { setRevoked(true); setReview({ ...review, requires_new_delegation: true }); } }
    } catch (failure) { if (current === generation.current) { setError(failure instanceof Error ? failure.message : 'Authorization could not be confirmed.'); setReview(null); } }
    finally { if (current === generation.current) { lock.current = false; setPending(false); } }
  };
  return <main className="mx-auto max-w-2xl p-6 text-ink">
    <h1 className="text-2xl font-semibold">Manage agent access to your rental</h1>
    {loading && <p role="status">Loading your secure authorization review…</p>}
    {error && <p role="alert" className="mt-4">{error}</p>}
    {!loading && ownedUuid(params.renewalId) && (!session || (session && Date.parse(session.expires_at) <= Date.now())) && <><p className="mt-4">Sign in again for fresh customer authorization. This does not create another rental request.</p><a className="mt-3 inline-block underline" href={customerSignInPath('authorization', params.renewalId)}>Sign in to manage access</a></>}
    {error && <button type="button" className="mt-3 underline" onClick={() => { latest.current.review = null; setReload((value) => value + 1); }}>Reload authorization review</button>}
    {review && review.renewal_id === params.renewalId && <>
      <h2 className="mt-6 text-xl">{review.vehicle_name} · {review.operator_name}</h2>
      <p>Existing request: {review.ref}</p><p>Status: {review.status}</p><p>Pickup: {review.pickup_at} · Return: {review.return_at}</p><p>Time zone: {review.timezone}</p>
      <p>Inventory hold deadline: {review.hold_expires_at ?? 'No active hold deadline'}</p><p>Payment deadline: {review.payment_due_at ?? 'Payment is not currently due'}</p>
      <p className="mt-3">Agent application: {review.agent_client_id}</p><p>Authorization review expires: {review.expires_at}</p>
      <ul className="mt-3 list-disc pl-6">{review.action_scopes.map((scope) => <li key={scope}>{scopeLabels[scope]}</li>)}</ul>
      <p className="mt-4">This changes only the listed agent access. Your existing rental request and its hold and payment deadlines remain unchanged. You complete payment yourself on customer-hosted checkout.</p>
      {review.requires_new_delegation && <p role="status" className="mt-4">Prior agent access was revoked. It stays revoked. You must explicitly authorize a new delegation to give this agent access again.</p>}
      {!revoked && (review.state === 'authorized' ? <p role="status" className="mt-4">Agent access authorized for the existing request.</p> : <button type="button" className="mt-4 rounded-lg border p-3 disabled:opacity-50" disabled={pending || !session || !canRecoverGrant(review, session)} onClick={() => mutate('renew')}>{pending ? 'Recording authorization…' : review.requires_new_delegation ? 'Authorize new agent access' : 'Reauthorize agent access'}</button>)}
      {(review.state === 'authorized' || !review.requires_new_delegation) && !revoked && <button type="button" className="mt-4 ml-3 rounded-lg border p-3 disabled:opacity-50" disabled={pending || !session || Date.parse(session.expires_at) <= Date.now()} onClick={() => mutate('revoke')}>Revoke agent access</button>}
      {revoked && <p role="status" className="mt-4">Agent access revoked. Your booking has not been cancelled. Ask your agent for a new authorization review if you later want to delegate access again.</p>}
    </>}
  </main>;
}
