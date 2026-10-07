/** Server-only customer login bridge. No issuer, cards, identity documents or
 * refresh tokens are implemented here. Managed OIDC code flow creates a short
 * customer session; the API independently verifies the resource access token.
 */
import {createCipheriv,createDecipheriv,randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify,SignJWT,type JWTVerifyGetKey} from 'jose';
export interface HostedAuthConfiguration {
 issuer:string; authorizationEndpoint:string; tokenEndpoint:string; jwksUri:string;
 allowedHosts:readonly string[]; resource:string; frontendOrigin:string;
 clientId:string; clientSecret:string; cookieKey:string; bridgeKey:string;
}
export interface HostedSession {
 issuer:string; subject:string; clientId:string; accessToken:string; expiresAt:number;
 csrf:string; profile:{email:string|null;emailVerified:boolean;name:string|null};
}
export interface HostedAuthDependencies { now?:()=>Date; fetch?:typeof fetch; keyResolver?:JWTVerifyGetKey; }
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const returnPath=new RegExp(`^(?:/agent/(?:consent|authorization|account)/${uuid}|/agent/handoff/[A-Za-z0-9_-]{43})$`,'i');
// Provider return carries a public reference and action only. Exact canonical
// ordering excludes arbitrary query fields, duplicate selectors and tokens.
const providerReturnPath=new RegExp(`^/agent/account/${uuid.replaceAll('a-f','a-fA-F')}\\?booking_ref=[A-Za-z0-9_-]{1,80}&action=(?:identity|checkout)$`);
const ownedReturnPath=(value:string)=>returnPath.test(value)||providerReturnPath.test(value);
const fail=():never=>{throw new Error('Customer authorization unavailable');};
const secret=(value:string)=>{if(!/^[A-Za-z0-9_-]{43}$/.test(value))fail();const bytes=Buffer.from(value,'base64url');if(bytes.length!==32)fail();return bytes;};
const equal=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
function providerUrl(value:string,hosts:readonly string[]):URL {
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search||(u.port&&u.port!=='443')||!hosts.includes(u.hostname)||u.hostname.includes(':')||/^[\d.]+$/.test(u.hostname)||/(?:^|\.)(?:local|localhost|internal)$/.test(u.hostname))fail();return u;
}
function publicUrl(value:string):URL {const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search||u.hostname.includes(':')||/^[\d.]+$/.test(u.hostname)||/(?:^|\.)(?:localhost|local|internal)$/.test(u.hostname))fail();return u;}
export async function sealCookie(key:string,purpose:'transaction'|'session',payload:unknown,expires:number):Promise<string>{
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret(key),iv);cipher.setAAD(Buffer.from('exotiq-hosted-v1:'+purpose));
 const encrypted=Buffer.concat([cipher.update(JSON.stringify({payload,expires}),'utf8'),cipher.final()]);
 const value=[iv,encrypted,cipher.getAuthTag()].map(x=>x.toString('base64url')).join('.');if(value.length>3800)fail();return value;
}
export async function openCookie(key:string,purpose:'transaction'|'session',value:string,now:number):Promise<any>{
 try {if(typeof value!=='string'||value.length>3800||!Number.isFinite(now))fail();const parts=value.split('.');if(parts.length!==3||parts.some(x=>!x||!/^[A-Za-z0-9_-]+$/.test(x)))fail();
  const [iv,encrypted,tag]=parts.map(x=>Buffer.from(x,'base64url'));if(iv.length!==12||tag.length!==16)fail();const decipher=createDecipheriv('aes-256-gcm',secret(key),iv);decipher.setAAD(Buffer.from('exotiq-hosted-v1:'+purpose));decipher.setAuthTag(tag);
  const data=JSON.parse(Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8'));if(!Number.isSafeInteger(data.expires)||data.expires<=now)fail();return data.payload;
 } catch {return fail();}
}
async function boundedJson(response:Response):Promise<any>{
 if(!response.ok||!response.headers.get('content-type')?.toLowerCase().startsWith('application/json')||!response.body)fail();
 const reader=response.body!.getReader();let size=0;const chunks:Uint8Array[]=[];
 try {for(;;){const {value,done}=await reader.read();if(done)break;if(value){size+=value.byteLength;if(size>65536){await reader.cancel();fail();}chunks.push(value);}}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return fail();}finally{reader.releaseLock();}
}
export function createHostedAuth(config:HostedAuthConfiguration|null,dependencies:HostedAuthDependencies={}){
 if(!config)fail();const c=config!;
 for(const u of [c.issuer,c.authorizationEndpoint,c.tokenEndpoint,c.jwksUri])providerUrl(u,c.allowedHosts);
 const front=publicUrl(c.frontendOrigin);if(front.origin!==c.frontendOrigin)fail();publicUrl(c.resource);
 if(!c.clientId||c.clientId.length>512||!c.clientSecret||c.clientSecret.length>4096)fail();secret(c.cookieKey);secret(c.bridgeKey);if(equal(c.cookieKey,c.bridgeKey))fail();
 const resolver=dependencies.keyResolver??createRemoteJWKSet(new URL(c.jwksUri),{timeoutDuration:3000,cooldownDuration:1000,cacheMaxAge:300000});
 const now=()=>dependencies.now?.()??new Date();const transport=dependencies.fetch??fetch;
 const algorithms=['ES256','RS256','PS256'];
 async function accessIdentity(token:string){
  const n=now();const {payload}=await jwtVerify(token,resolver,{issuer:c.issuer,audience:c.resource,algorithms,typ:'at+jwt',requiredClaims:['iss','aud','sub','iat','nbf','exp','jti','client_id','scope'],currentDate:n,clockTolerance:0});
  const t=Math.floor(n.getTime()/1000);if(payload.aud!==c.resource||payload.client_id!==c.clientId||typeof payload.sub!=='string'||!payload.sub||payload.sub.length>256||typeof payload.jti!=='string'||!payload.jti||typeof payload.scope!=='string'||!Number.isInteger(payload.iat)||!Number.isInteger(payload.exp)||!Number.isInteger(payload.nbf)||payload.iat!>t||payload.nbf!<payload.iat!||payload.exp!<=payload.iat!||payload.exp!-payload.iat!>600)fail();return payload;
 }
 return {
  async beginLogin(destination:string){
   if(!ownedReturnPath(destination))fail();const verifier=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url'),state=randomBytes(32).toString('base64url');
   const url=new URL(c.authorizationEndpoint);for(const [k,v] of Object.entries({response_type:'code',client_id:c.clientId,redirect_uri:c.frontendOrigin+'/api/agent/auth/callback',scope:'openid email profile quotes:create rental_requests:create rental_requests:read checkout:handoff',resource:c.resource,state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',max_age:'0'}))url.searchParams.set(k,v);
   return {url:url.toString(),cookie:await sealCookie(c.cookieKey,'transaction',{verifier,nonce,state,destination},now().getTime()+600000)};
  },
  async completeLogin(callback:URL,transactionCookie:string){
   try {if(callback.origin!==c.frontendOrigin||callback.pathname!=='/api/agent/auth/callback'||callback.searchParams.getAll('state').length!==1||callback.searchParams.getAll('code').length!==1||callback.searchParams.getAll('iss').length!==1||callback.searchParams.has('error'))fail();
    const tx=await openCookie(c.cookieKey,'transaction',transactionCookie,now().getTime());
    if(typeof tx.state!=='string'||!equal(tx.state,callback.searchParams.get('state')??'')||!ownedReturnPath(tx.destination)||callback.searchParams.get('iss')!==c.issuer)fail();
    const code=callback.searchParams.get('code');if(!code||code.length>2048)fail();
    const body=new URLSearchParams({grant_type:'authorization_code',code:code!,redirect_uri:c.frontendOrigin+'/api/agent/auth/callback',code_verifier:tx.verifier,resource:c.resource});
    const response=await transport(c.tokenEndpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{'content-type':'application/x-www-form-urlencoded',authorization:'Basic '+Buffer.from(encodeURIComponent(c.clientId)+':'+encodeURIComponent(c.clientSecret)).toString('base64')},body});
    const result=await boundedJson(response);if(result.token_type?.toLowerCase()!=='bearer'||typeof result.id_token!=='string'||typeof result.access_token!=='string'||result.id_token.length>16384||result.access_token.length>16384)fail();
    const {payload:id,protectedHeader}=await jwtVerify(result.id_token,resolver,{issuer:c.issuer,audience:c.clientId,algorithms,requiredClaims:['iss','aud','sub','iat','exp','nonce','auth_time'],currentDate:now(),clockTolerance:0});
    const seconds=Math.floor(now().getTime()/1000);if(id.nonce!==tx.nonce||typeof id.sub!=='string'||!id.sub||!Number.isInteger(id.iat)||!Number.isInteger(id.auth_time)||id.iat!>seconds||typeof id.auth_time!=='number'||id.auth_time>seconds||id.auth_time<seconds-300||(id.azp!==undefined&&id.azp!==c.clientId)||(Array.isArray(id.aud)&&id.azp!==c.clientId))fail();
    if(id.at_hash!==undefined){if(!['ES256','RS256','PS256'].includes(protectedHeader.alg)||id.at_hash!==createHash('sha256').update(result.access_token).digest().subarray(0,16).toString('base64url'))fail();}
    const access=await accessIdentity(result.access_token);if(access.sub!==id.sub)fail();
    const expiresAt=Math.min(access.exp!*1000,now().getTime()+600000);
    const session:HostedSession={issuer:c.issuer,subject:id.sub!,clientId:c.clientId,accessToken:result.access_token,expiresAt,csrf:randomBytes(32).toString('base64url'),profile:{email:typeof id.email==='string'&&id.email.length<=320?id.email:null,emailVerified:id.email_verified===true,name:typeof id.name==='string'&&id.name.length<=160?id.name:null}};
    return {returnTo:tx.destination,cookie:await sealCookie(c.cookieKey,'session',session,expiresAt),expiresAt};
   } catch {return fail();}
  },
  async readSession(cookie:string):Promise<HostedSession>{
   try {const s=await openCookie(c.cookieKey,'session',cookie,now().getTime()) as HostedSession;
    if(s.issuer!==c.issuer||s.clientId!==c.clientId||typeof s.accessToken!=='string'||typeof s.subject!=='string'||typeof s.csrf!=='string'||!s.profile||!Number.isSafeInteger(s.expiresAt)||s.expiresAt<=now().getTime())fail();
    const identity=await accessIdentity(s.accessToken);if(identity.sub!==s.subject||s.expiresAt>identity.exp!*1000)fail();return s;
   }catch{return fail();}
  },
  assertCsrf(session:HostedSession,origin:string|null,csrf:string){if(origin!==c.frontendOrigin||!equal(session.csrf,csrf))fail();},
  async hostedProof(session:HostedSession,method:string,url:URL,body:string){
   if(url.origin!==new URL(c.resource).origin||!url.pathname.startsWith(new URL(c.resource).pathname.replace(/\/$/,'')+'/v1/')||url.search||url.hash||!['GET','POST'].includes(method)||Buffer.byteLength(body)>65536)fail();
   const t=Math.floor(now().getTime()/1000);
   return new SignJWT({provider_issuer:session.issuer,provider_subject:session.subject,client_id:session.clientId,method,path:url.pathname,body_hash:createHash('sha256').update(body).digest('hex'),token_hash:createHash('sha256').update(session.accessToken).digest('hex'),csrf_hash:createHash('sha256').update(session.csrf).digest('hex'),profile_email:session.profile.email,profile_email_verified:session.profile.emailVerified,profile_name:session.profile.name}).setProtectedHeader({alg:'HS256',typ:'exotiq-hosted-proof+jwt'}).setIssuer(c.frontendOrigin).setAudience(c.resource).setIssuedAt(t).setExpirationTime(t+30).setJti(randomBytes(32).toString('base64url')).sign(secret(c.bridgeKey));
  },
 };
}
