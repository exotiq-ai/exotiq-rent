import {createHostedAuth,type HostedAuthConfiguration,type HostedSession} from './hostedAuth.server';
const id='[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const get=new RegExp(`^(?:quotes/${id}|grant-renewals/${id})$`,'i');
const post=new RegExp(`^(?:quotes/${id}/consents|grants/${id}/revoke|grant-renewals/${id}/(?:review|complete)|customers/operator-links)$`,'i');
const forbidden=new Set(['confirmation_token','access_token','refresh_token','id_token','consent_receipt_id','driver_license','card_number','service_role_key','secret_hash']);
function safeOutput(value:unknown,depth=0):boolean {
 if(depth>20)return false;if(value&&typeof value==='object'){for(const [k,v] of Object.entries(value)){if(forbidden.has(k.toLowerCase())||!safeOutput(v,depth+1))return false;}}return true;
}
/** Called only after readSession() has verified the encrypted session and actual
 * resource JWT. Customer JS sees neither the bearer nor server proof headers. */
export async function forwardHostedRequest(config:HostedAuthConfiguration,session:HostedSession,method:'GET'|'POST',path:string,input:Record<string,unknown>|null,origin:string|null,transport:typeof fetch=fetch){
 const fail=():never=>{throw new Error('Customer request unavailable');};
 if(session.expiresAt<=Date.now()||!((method==='GET'?get:post).test(path)))fail();
 const auth=createHostedAuth(config);let payload:Record<string,unknown>={};
 if(method==='POST'){
  if(!input||typeof input.csrf!=='string')fail();auth.assertCsrf(session,origin,input!.csrf as string);
  const {csrf:_,...fields}=input!;payload=fields;
  if(path==='customers/operator-links'){
   if(!session.profile.email||!session.profile.emailVerified)fail();
   payload={...fields,email:session.profile.email,email_verified:true};
  }
 }
 const body=method==='GET'?'':JSON.stringify(payload);if(Buffer.byteLength(body)>65536)fail();
 const url=new URL(config.resource.replace(/\/$/,'')+'/v1/'+path);
 const proof=await auth.hostedProof(session,method,url,body);
 const upstream=await transport(url,{method,headers:{authorization:'Bearer '+session.accessToken,'X-Exotiq-Hosted-Proof':proof,'content-type':'application/json'},body:method==='POST'?body:undefined,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});
 if(upstream.status===204)return {status:204,body:null};
 if(!upstream.headers.get('content-type')?.toLowerCase().startsWith('application/json')||!upstream.body)fail();
 const reader=upstream.body!.getReader();let size=0;const chunks:Uint8Array[]=[];
 try{for(;;){const part=await reader.read();if(part.done)break;if(part.value){size+=part.value.byteLength;if(size>65536){await reader.cancel();fail();}chunks.push(part.value);}}const output=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!safeOutput(output))fail();return {status:upstream.status,body:output};}finally{reader.releaseLock();}
}
