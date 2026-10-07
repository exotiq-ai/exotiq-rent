'use client';
import { use, useEffect, useRef, useState } from 'react';
import { customerSignInPath, readCustomerSession } from '@/domain/booking/externalConsent';
import { ownedUuid, type CustomerSession } from '@/domain/booking/externalContracts';
import { linkOperatorCustomer } from '@/domain/booking/externalGrantRecovery';
import {accountProviderReturnPath,parseProviderReturnQuery,type ProviderReturn} from '@/domain/booking/customerProviderReturn';
const emptyQuery=Promise.resolve({});
export default function AccountPage({ params: pendingParams,searchParams=emptyQuery }: { params: Promise<{ operatorId: string }>;searchParams?:Promise<Record<string,string|string[]|undefined>> }) {
  const params = use(pendingParams);
  const query=use(searchParams);let providerReturn:ProviderReturn|null=null,invalidQuery=false;
  try{providerReturn=parseProviderReturnQuery(query);}catch{invalidQuery=true;}
  const returnKey=invalidQuery?'invalid':providerReturn?`${providerReturn.action}:${providerReturn.ref}`:'';
  const [session, setSession] = useState<CustomerSession | null>(null), [loading, setLoading] = useState(true), [pending, setPending] = useState(false), [linked, setLinked] = useState(false), [error, setError] = useState('');
  const [name, setName] = useState(''), [phone, setPhone] = useState('');
  const [, tick] = useState(0);
  const lock = useRef(false), generation = useRef(0);
  const latest = useRef({ session, name, phone, id: params.operatorId }); latest.current = { session, name, phone, id: params.operatorId };
  useEffect(() => {
    const epoch = generation; const current = ++epoch.current; setLoading(true); setSession(null); setLinked(false); setError(''); setName(''); setPhone(''); setPending(false); lock.current = false;
    void (async () => { try {
      if (!ownedUuid(params.operatorId)||invalidQuery) throw Error('Invalid operator account.');
      const result = await readCustomerSession(); if (current !== generation.current) return; setSession(result); setName(result?.profile.name ?? '');
    } catch { if (current === generation.current) setError('Customer account linking is unavailable.'); }
    finally { if (current === generation.current) setLoading(false); } })();
    const timer = setInterval(() => tick((value) => value + 1), 1000);
    return () => { ++epoch.current; clearInterval(timer); };
  }, [params.operatorId,returnKey,invalidQuery]);
  const valid = session && session.profile.emailVerified && session.profile.email && Date.parse(session.expires_at) > Date.now() && name.trim().length > 0 && name.trim().length <= 160 && /^\+?[0-9 ()-]{7,30}$/.test(phone);
  const link = async () => {
    if (lock.current || linked || !session || latest.current.session !== session || latest.current.id !== params.operatorId || latest.current.name !== name || latest.current.phone !== phone || !valid) return;
    lock.current = true; setPending(true); setError(''); const current = generation.current;
    try { await linkOperatorCustomer(params.operatorId, session, name, phone); if (current === generation.current) setLinked(true); }
    catch (failure) { if (current === generation.current) setError(failure instanceof Error ? failure.message : 'Customer account linking could not be confirmed.'); }
    finally { if (current === generation.current) { lock.current = false; setPending(false); } }
  };
  if(invalidQuery)return <main className="mx-auto max-w-2xl p-6 text-ink"><h1 className="text-heading font-semibold">Invalid provider return</h1><p className="mt-4" role="alert">This return link could not be confirmed. Reopen your rental request from your agent.</p></main>;
  if(providerReturn)return <main className="mx-auto max-w-2xl p-6 text-ink">
    <h1 className="text-heading font-semibold">Returned from hosted {providerReturn.action==='checkout'?'payment':'identity verification'}</h1>
    <p className="mt-4">Returning here does not confirm payment or identity verification. Only the current rental record can confirm its status.</p>
    {loading&&<p role="status" className="mt-4">Checking your secure customer sign-in…</p>}
    {error&&<p role="alert" className="mt-4">{error}</p>}
    {!loading&&(!session||Date.parse(session.expires_at)<=Date.now())&&ownedUuid(params.operatorId)&&<a className="mt-4 inline-block underline" href={'/api/agent/auth/start?return_to='+encodeURIComponent(accountProviderReturnPath(params.operatorId,providerReturn))}>Sign in to review your rental request</a>}
    {!loading&&session&&Date.parse(session.expires_at)>Date.now()&&<><p className="mt-4">Rental reference: {providerReturn.ref}</p><p className="mt-3">Return to your agent to check the current rental request status.</p></>}
  </main>;
  return <main className="mx-auto max-w-2xl p-6 text-ink">
    <h1 className="text-heading font-semibold">Link your customer account</h1>
    {loading && <p role="status">Checking your secure customer sign-in…</p>}
    {error && <p role="alert" className="mt-4">{error}</p>}
    {!loading && (!session || Date.parse(session.expires_at) <= Date.now()) && ownedUuid(params.operatorId) && <><p className="mt-4">Sign in securely with a fresh verified email to link your account with this operator.</p><a className="mt-3 inline-block underline" href={customerSignInPath('account', params.operatorId)}>Sign in to link account</a></>}
    {session && <>
      <p className="mt-4">Operator account: {params.operatorId}</p>
      <p>Signed-in email: {session.profile.email ?? 'No provider email available'}</p>
      {(!session.profile.emailVerified || !session.profile.email) && <p role="status" className="mt-3">A verified email from your sign-in provider is required. Typing an email here cannot establish account ownership. Sign in with a verified email before linking.</p>}
      <label className="mt-4 block">Full name<input className="mt-1 block w-full rounded border p-2" name="full_name" maxLength={160} value={name} onChange={(event) => setName(event.target.value)} disabled={pending || linked} autoComplete="name" /></label>
      <label className="mt-4 block">Phone number<input className="mt-1 block w-full rounded border p-2" name="phone" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} disabled={pending || linked} autoComplete="tel" type="tel" /></label>
      <p className="mt-4">By choosing Link my customer account, you authorize this operator to associate your verified sign-in with its customer record and use these contact details for your rental request. No booking or agent delegation is created.</p>
      <p className="mt-3">A new account may need fresh identity verification before earlier rental identity documents can be trusted.</p>
      {!linked && <button type="button" className="mt-4 rounded-lg border p-3 disabled:opacity-50" disabled={!valid || pending} onClick={link}>{pending ? 'Linking customer account…' : 'Link my customer account'}</button>}
      {linked && <p role="status" className="mt-4">Customer account linked. Return to your agent and reopen the rental review.</p>}
    </>}
  </main>;
}
