import {cookies} from 'next/headers';
import {hostedRuntime,CUSTOMER_COOKIE} from '@/domain/booking/hostedRuntime.server';
import {forwardCustomerHandoff,handoffSignIn,parseHandoffReview} from '@/domain/booking/customerHandoffServer';
import {handoffNonce} from '@/domain/booking/customerHandoff';
import CustomerHandoffLanding from './CustomerHandoffLanding';
export const dynamic='force-dynamic';
export const revalidate=0;
export default async function CustomerHandoffPage({params:pendingParams}:{params:Promise<{nonce:string}>}){
 const params=await pendingParams;
 if(!handoffNonce.test(params.nonce))return <main><h1>Secure handoff unavailable</h1><p>Request a fresh link from your agent.</p></main>;
 let runtime,session;
 try{runtime=hostedRuntime();session=await runtime.auth.readSession((await cookies()).get(CUSTOMER_COOKIE)?.value??'');}
 catch{return <main className="mx-auto max-w-xl px-6 py-12"><h1 className="text-2xl font-semibold">Sign in to continue your rental request</h1><p className="mt-4">A fresh customer sign-in is required to open this secure handoff.</p><a className="mt-6 inline-block underline" href={handoffSignIn(params.nonce)}>Sign in securely</a></main>;}
 let review=null;
 try{const result=await forwardCustomerHandoff(runtime.config,session,params.nonce,'GET',null,null);if(result.status===200)review=parseHandoffReview(result.body);}catch{}
 return <CustomerHandoffLanding nonce={params.nonce} review={review} csrf={session.csrf} sessionExpiresAt={session.expiresAt}/>;
}
