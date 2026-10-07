'use client';
import { use, useEffect, useRef, useState } from 'react';
import { authorizeQuote, canAuthorizeQuote, customerSignInPath, readCustomerSession, readQuoteReview,CUSTOMER_ACTION_SCOPES,customerActionLabels,validConsentScopes,type CustomerActionScope } from '@/domain/booking/externalConsent';
import { ownedUuid, type CustomerSession, type QuoteReview } from '@/domain/booking/externalContracts';
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
export default function ConsentPage({ params: pendingParams }: { params: Promise<{ quoteId: string }> }) {
  const params = use(pendingParams);
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [review, setReview] = useState<QuoteReview | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [authorized, setAuthorized] = useState(false), [pending, setPending] = useState(false);
  const [, tick] = useState(0); const locked = useRef(false); const generation = useRef(0);
  const [reload, setReload] = useState(0);
  const [scopes,setScopes]=useState<CustomerActionScope[]>([]);
  const latest = useRef({ review, session, authorized,scopes, quoteId: params.quoteId });
  latest.current = { review, session, authorized,scopes, quoteId: params.quoteId };
  useEffect(() => {
    const epoch = generation; const current = ++epoch.current;
    setLoading(true); setReview(null); setSession(null); setAuthorized(false);setScopes([]); setError(''); locked.current = false;
    void (async () => {
      try { if (!ownedUuid(params.quoteId)) throw Error('Invalid customer request.');
        const signedIn = await readCustomerSession(); if (current !== generation.current) return; setSession(signedIn);
        if (signedIn) { const quote = await readQuoteReview(params.quoteId); if (current === generation.current) setReview(quote); }
      } catch { if (current === generation.current) setError('The complete rental terms could not be confirmed. Ask your agent for a fresh quote, or sign in again.'); }
      finally { if (current === generation.current) setLoading(false); }
    })();
    const timer = setInterval(() => tick((value) => value + 1), 1000);
    return () => { ++epoch.current; clearInterval(timer); };
  }, [params.quoteId, reload]);
  const authorize = async () => {
    if (locked.current || !review || review.quote.quote_id !== params.quoteId || !session || authorized || latest.current.review !== review || latest.current.session !== session || latest.current.quoteId !== params.quoteId || latest.current.authorized||latest.current.scopes!==scopes||!validConsentScopes(review,scopes)) return;
    if (!canAuthorizeQuote(review, session)) { setError('This quote or sign-in expired. Sign in again and request a fresh quote.'); return; }
    locked.current = true; setPending(true); setError(''); const current = generation.current;
    try { await authorizeQuote(review, session,scopes); if (current === generation.current) setAuthorized(true); }
    catch (failure) { if (current === generation.current) { setError(failure instanceof Error ? failure.message : 'Authorization could not be confirmed.'); setReview(null); } }
    finally { if (current === generation.current) { locked.current = false; setPending(false); } }
  };
  const valid = review && review.quote.quote_id === params.quoteId && session && canAuthorizeQuote(review, session);
  return <main className="mx-auto max-w-2xl p-6 text-ink">
    <h1 className="text-heading font-semibold">Review your rental request</h1>
    {loading && <p role="status">Loading your secure review…</p>}
    {error && <p role="alert" className="mt-4">{error}</p>}
    {error && !loading && <button type="button" className="mt-3 underline" onClick={() => { latest.current.review = null; setReload((value) => value + 1); }}>Reload secure review</button>}
    {!loading && (!session || Date.parse(session.expires_at) <= Date.now()) && ownedUuid(params.quoteId) && <><p className="mt-4">Sign in securely to review and authorize this request. Customer sign-in must be configured before you can continue.</p><a className="mt-3 inline-block underline" href={customerSignInPath('consent', params.quoteId)}>Sign in to review</a></>}
    {review && review.quote.quote_id === params.quoteId && <>
      <h2 className="mt-6 text-title">{review.vehicle_name} · {review.operator_name}</h2>
      <p className="mt-2">Agent application: {review.agent_client_id}</p>
      <p className="mt-2">Pickup: {review.quote.pickup_at} · Return: {review.quote.return_at}</p><p>Time zone: {review.quote.timezone}</p>
      <p>Quote expires: {review.quote.expires_at}</p><p>This quote does not hold inventory.</p>
      <h2 className="mt-6 text-title-sm">Charges after approval</h2>
      <dl className="mt-2 space-y-2">
        {Object.entries({ Rental: review.quote.itemization.rental_subtotal_cents, [`${review.quote.pricing_details.operator_tax_label} (${review.quote.pricing_details.operator_tax_rate_percent}%${review.quote.itemization.operator_tax_inclusive ? ', included in rental' : ''})`]: review.quote.itemization.operator_tax_cents, [`Platform fee (${review.quote.pricing_details.platform_fee_percent}%)`]: review.quote.itemization.platform_fee_cents, Protection: review.quote.itemization.protection_total_cents, [review.quote.pricing_details.state_fee_label]: review.quote.itemization.state_fee_cents, Processing: review.quote.itemization.processing_fee_cents }).map(([label, cents]) => <div key={label} className="flex justify-between gap-4"><dt>{label}</dt><dd>{money(cents)}</dd></div>)}
        <div className="flex justify-between"><dt>Rental total</dt><dd>{money(review.quote.total_cents)}</dd></div>
        <div className="flex justify-between"><dt>Separate security deposit</dt><dd>{money(review.quote.itemization.deposit_cents)}</dd></div>
      </dl>
      <p className="mt-3">{review.quote.pricing_details.rental_days} rental days at {money(review.quote.pricing_details.daily_rate_cents)} per day. Protection: {review.quote.pricing_details.protection_tier}, {money(review.quote.pricing_details.protection_daily_cents)} per day. {review.quote.pricing_details.state_fee_label}: {money(review.quote.pricing_details.state_fee_daily_cents)} per day.</p>
      <p className="mt-3">{review.operator_name}: {money(review.quote.operator_total_cents)} after operator approval. Exotiq: {money(review.quote.exotiq_total_cents)} after the operator charge.</p>
      <h2 className="mt-6 text-title-sm">Pickup and rental terms</h2>
      <p>{review.quote.terms.pickup_address ?? 'Pickup location is arranged with the operator.'}</p><p>{review.quote.terms.pickup_instructions}</p>
      <p className="mt-3">{review.quote.terms.cancellation_policy}</p><p>{review.quote.terms.deposit_disclosure}</p>
      <p>Mileage allowance: {review.quote.terms.mileage_limit === null ? 'Confirm with operator' : `${review.quote.terms.mileage_limit} miles`}. Overage: {review.quote.terms.mileage_overage_rate_usd === null ? 'Confirm with operator' : `$${review.quote.terms.mileage_overage_rate_usd} per mile`}.</p>
      <p className="mt-6">Authorize the agent to submit this exact rental request. It remains pending operator approval. You complete identity verification and hosted payment yourself; no payment is made by this authorization.</p>
      <fieldset className="mt-4 space-y-3" disabled={pending||authorized}>
        <legend className="text-title-sm">Choose the agent actions you authorize</legend>
        {CUSTOMER_ACTION_SCOPES.map(scope=><label className="block" key={scope}><input type="checkbox" name={scope} checked={scopes.includes(scope)} onChange={event=>{const checked=event.target.checked;latest.current.scopes=[];setScopes(current=>CUSTOMER_ACTION_SCOPES.filter(value=>value===scope?checked:current.includes(value)));}} /> <span>{customerActionLabels[scope]}</span></label>)}
      </fieldset>
      <p className="mt-3">Select at least one action. Identity and payment links require your own secure sign-in and explicit Continue; your agent cannot submit documents or make payment for you.</p>
      {!valid && <p role="status" className="mt-3">This quote or sign-in has expired. Sign in again and ask your agent for a fresh quote.</p>}
      {!authorized && <button type="button" className="mt-4 rounded-lg border p-3 disabled:opacity-50" disabled={!valid || pending||!validConsentScopes(review,scopes)} onClick={authorize}>{pending ? 'Recording authorization…' : 'Authorize rental request'}</button>}
    </>}
    {authorized && <p role="status" className="mt-6">Authorization recorded. Your agent can submit this request securely. The rental is pending operator approval.</p>}
    <p className="mt-6 text-body-sm">Keep payment details and identity documents on the customer-hosted verification and checkout pages.</p>
  </main>;
}
