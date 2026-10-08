import {createHostedAuth,type HostedAuthConfiguration,type HostedSession} from './hostedAuth.server';
import {handoffNonce,handoffRecoveryCode,parseHandoffReview,parseHandoffResolve} from './customerHandoff';
import {validateContract} from './externalContracts.generated';
export {handoffSignIn,parseHandoffReview,parseHandoffResolve} from './customerHandoff';
const fail=():never=>{throw new Error('Customer handoff unavailable');};
async function boundedJson(response:Response):Promise<unknown>{
 if(!response.headers.get('content-type')?.toLowerCase().startsWith('application/json')||!response.body)fail();
 const reader=response.body!.getReader();let size=0;const chunks:Uint8Array[]=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;if(value){size+=value.byteLength;if(size>65536){await reader.cancel();fail();}chunks.push(value);}}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}finally{reader.releaseLock();}
}
/** Server-only: callers must first verify the encrypted managed customer cookie.
 * The backend independently checks ownership, active delegation and booking state. */
export async function forwardCustomerHandoff(config:HostedAuthConfiguration,session:HostedSession,nonce:string,method:'GET'|'POST',input:Record<string,unknown>|null,origin:string|null,transport:typeof fetch=fetch){
 if(typeof window!=='undefined'||!handoffNonce.test(nonce)||session.expiresAt<=Date.now())fail();
 const auth=createHostedAuth(config);let body='';
 if(method==='POST'){
  if(!input||Object.keys(input).sort().join(',')!=='action,csrf'||input.action!=='continue'||typeof input.csrf!=='string')fail();
  auth.assertCsrf(session,origin,input!.csrf as string);const payload={action:input!.action};if(!validateContract('CustomerHandoffResolveInput',payload).ok)fail();body=JSON.stringify(payload);
 }
 const url=new URL(config.resource.replace(/\/$/,'')+`/v1/customer-handoffs/${nonce}/${method==='GET'?'review':'resolve'}`);
 const proof=await auth.hostedProof(session,method,url,body);
 const response=await transport(url,{method,headers:{authorization:'Bearer '+session.accessToken,'X-Exotiq-Hosted-Proof':proof,'content-type':'application/json'},body:method==='POST'?body:undefined,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});
 if(response.status>=400&&response.status<=599){let code='handoff_unavailable';if(response.status===409){try{const value=await boundedJson(response);if(validateContract('ApiError',value).ok)code=handoffRecoveryCode((value as {code:unknown}).code)??code;}catch{}}else await response.body?.cancel();return {status:response.status,body:{code}};}
 if(response.status!==200||!response.headers.get('content-type')?.toLowerCase().startsWith('application/json')||!response.body)fail();
 const value=await boundedJson(response),output=method==='GET'?parseHandoffReview(value):parseHandoffResolve(value);
 if('provider_url' in output&&output.provider_url.includes(nonce))fail();return {status:200,body:output};
}
