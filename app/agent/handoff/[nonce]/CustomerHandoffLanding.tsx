'use client';
import {useEffect,useRef,useState} from 'react';
import {parseHandoffReview,parseHandoffResolve,parseHandoffRenewal,handoffRecoveryCode,handoffSignIn,type HandoffReview,type HandoffResolve,type HandoffRecoveryCode,type HandoffRenewal} from '@/domain/booking/customerHandoff';
export default function CustomerHandoffLanding({nonce,review,csrf,sessionExpiresAt,recoveryCode=null}:{nonce:string;review:HandoffReview|null;csrf:string;sessionExpiresAt:number;recoveryCode?:HandoffRecoveryCode|null}){
 const current=useRef(nonce);current.current=nonce;
 const generation=useRef(0),busy=useRef(false);
 const [ready,setReady]=useState(false);
 const [recovery,setRecovery]=useState<HandoffRecoveryCode|null>(handoffRecoveryCode(recoveryCode)),[renewal,setRenewal]=useState<HandoffRenewal|null>(null);
 const currentRecovery=useRef(recovery);currentRecovery.current=recovery;
 const [pending,setPending]=useState(false),[error,setError]=useState(false),[target,setTarget]=useState<HandoffResolve|null>(null),[now,setNow]=useState(Date.now());
 useEffect(()=>{const epoch=generation;epoch.current++;setReady(true);busy.current=false;setRecovery(handoffRecoveryCode(recoveryCode));setRenewal(null);setPending(false);setError(false);setTarget(null);const tick=setInterval(()=>setNow(Date.now()),1000);return()=>{epoch.current++;clearInterval(tick);};},[nonce,review,recoveryCode]);
 let checked:HandoffReview|null=null;try{checked=review?parseHandoffReview(review,now):null;}catch{}
 const available=!!checked&&sessionExpiresAt>now&&!recovery;
 async function proceed(){
  if(!ready||busy.current||current.current!==nonce||currentRecovery.current)return;
  try{if(!review||sessionExpiresAt<=Date.now())throw Error();parseHandoffReview(review);}catch{setError(true);setNow(Date.now());return;}
  busy.current=true;setPending(true);setError(false);const epoch=generation.current;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{const response=await fetch(`/api/agent/handoff/${nonce}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({csrf,action:'continue'}),credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
   if(!response.headers.get('content-type')?.startsWith('application/json'))throw Error();const raw=await response.json();
   if(response.status===409&&raw&&typeof raw==='object'&&Object.keys(raw).join(',')==='code'){
    const code=handoffRecoveryCode(raw.code);if(code&&current.current===nonce&&generation.current===epoch){setTarget(null);setRecovery(code);return;}
   }
   if(!response.ok)throw Error();const value=parseHandoffResolve(raw);
   if(value.action!==review!.action||sessionExpiresAt<=Date.now())throw Error();
   if(current.current===nonce&&generation.current===epoch)setTarget(value);
  }catch{if(current.current===nonce&&generation.current===epoch){setTarget(null);setError(true);}}
  finally{clearTimeout(timer);if(current.current===nonce&&generation.current===epoch){busy.current=false;setPending(false);}}
 }
 async function recover(){
  const code=currentRecovery.current;if(!ready||!code||busy.current||current.current!==nonce||sessionExpiresAt<=Date.now())return;
  busy.current=true;setPending(true);setError(false);setRenewal(null);const epoch=generation.current;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{const response=await fetch(`/api/agent/customer/customer-handoffs/${nonce}/grant-renewals`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({csrf,action:'continue'}),credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
   if(response.status!==201||!response.headers.get('content-type')?.startsWith('application/json'))throw Error();const value=parseHandoffRenewal(await response.json(),location.origin);
   if(sessionExpiresAt<=Date.now())throw Error();if(current.current===nonce&&generation.current===epoch&&currentRecovery.current===code)setRenewal(value);
  }catch{if(current.current===nonce&&generation.current===epoch){setRenewal(null);setError(true);}}
  finally{clearTimeout(timer);if(current.current===nonce&&generation.current===epoch){busy.current=false;setPending(false);}}
 }
 const destination=target&&Date.parse(target.expires_at)>now&&sessionExpiresAt>now?target:null;
 return <main className="mx-auto max-w-xl px-6 py-12"><h1 className="text-heading font-semibold">Continue your rental request</h1>
  {checked&&<><p className="mt-4">{checked.operator_name} · {checked.vehicle_name}</p><p>Request {checked.ref} · {checked.status.replaceAll('_',' ')}</p><p>{checked.action==='identity'?'Verify your identity with Stripe.':'Review and complete your hosted payment with Stripe.'}</p><p>Link expires {new Date(checked.expires_at).toLocaleString()}.</p><p className="mt-4">Your agent cannot access this provider session. Continuing does not bypass operator approval or change your rental terms.</p></>}
  {!available&&<p role="alert" className="mt-4">This secure handoff is unavailable or expired. Sign in again or ask your agent for a fresh link.</p>}
  {error&&<p role="alert" className="mt-4">The handoff could not be confirmed. Retry while this link is valid, or sign in again.</p>}
  {recovery&&sessionExpiresAt>now&&<>
   <p className="mt-4">{recovery==='grant_revoked'?'Your prior agent access was revoked. It stays revoked.':'Your prior agent access expired.'} You can review a new authorization for the same agent and original scopes. Opening the review does not authorize access or change your rental hold.</p>
   {renewal&&Date.parse(renewal.expires_at)>now?<a className="mt-6 inline-block underline" href={renewal.customer_url} rel="noopener noreferrer" referrerPolicy="no-referrer">Open agent authorization review</a>:<button type="button" className="mt-6 rounded-lg border px-5 py-3 disabled:opacity-50" disabled={!ready||pending} onClick={recover}>{pending?'Opening authorization review…':'Review agent access'}</button>}
  </>}
  {sessionExpiresAt<=now&&<a className="mt-6 inline-block underline" href={handoffSignIn(nonce)}>Sign in again to continue</a>}
  {destination?<a className="mt-6 inline-block underline" href={destination.provider_url} rel="noreferrer noopener" referrerPolicy="no-referrer">Open Stripe securely</a>:available&&<button className="mt-6 rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50" type="button" disabled={!ready||pending} onClick={proceed}>{pending?'Confirming secure handoff…':'Continue securely'}</button>}
 </main>;
}
