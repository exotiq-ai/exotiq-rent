import {describe,it,expect} from 'vitest';
import {generateKeyPair,SignJWT} from 'jose';
import {createHostedAuth,sealCookie,openCookie} from './hostedAuth.server';
const key=Buffer.alloc(32,4).toString('base64url');
const cfg={issuer:'https://identity.example.invalid',authorizationEndpoint:'https://identity.example.invalid/authorize',tokenEndpoint:'https://identity.example.invalid/token',jwksUri:'https://identity.example.invalid/jwks',allowedHosts:['identity.example.invalid'],resource:'https://api.example.invalid/external-booking-api',frontendOrigin:'https://rent.example.invalid',clientId:'hosted-customer',clientSecret:'synthetic-test-only',cookieKey:key,bridgeKey:key};
const now=new Date('2030-01-01T00:00:00Z');
const returnTo='/agent/consent/10000000-0000-4000-8000-000000000008';
describe('hosted customer OIDC bridge',()=>{
 it('uses PKCE S256, nonce, exact callback/resource and a bounded owned return path',async()=>{
  const client=createHostedAuth(cfg,{now:()=>now});const login=await client.beginLogin(returnTo);
  const url=new URL(login.url);expect(url.searchParams.get('code_challenge_method')).toBe('S256');expect(url.searchParams.get('resource')).toBe(cfg.resource);expect(url.searchParams.get('redirect_uri')).toBe(cfg.frontendOrigin+'/api/agent/auth/callback');expect(url.searchParams.get('response_type')).toBe('code');expect(url.searchParams.get('nonce')).toMatch(/^[\w-]{43}$/);
  expect(JSON.stringify(login)).not.toContain('synthetic-test-only');expect(JSON.stringify(login)).not.toContain('code_verifier');
 });
 it.each(['https://evil.example/','//evil.example','/agent/consent/x?access_token=secret','/api/admin','/agent/consent/../../settings'])('denies arbitrary return destination %s',async(path)=>{await expect(createHostedAuth(cfg).beginLogin(path)).rejects.toThrow();});
 it('refuses provider URL tricks and missing production configuration',()=>{
  expect(()=>createHostedAuth({...cfg,tokenEndpoint:'http://127.0.0.1/token'})).toThrow();expect(()=>createHostedAuth({...cfg,clientSecret:''})).toThrow();expect(()=>createHostedAuth(null)).toThrow();
 });
 it('encrypts cookie contents, denies tampering/wrongpurpose/expiry and leaks no token',async()=>{
  const cookie=await sealCookie(key,'session',{accessToken:'synthetic-access'},now.getTime()+1000);expect(cookie).not.toContain('synthetic-access');expect(await openCookie(key,'session',cookie,now.getTime())).toEqual({accessToken:'synthetic-access'});
  await expect(openCookie(key,'transaction',cookie,now.getTime())).rejects.toThrow();await expect(openCookie(key,'session',cookie,now.getTime()+1001)).rejects.toThrow();await expect(openCookie(key,'session',cookie.slice(0,-3)+'bad',now.getTime())).rejects.toThrow();
 });
 it('verifies actual signed ID/access tokens and binds issuer, subject, nonce, audience and client',async()=>{
  const {privateKey,publicKey}=await generateKeyPair('ES256');let tx:any;
  const client=createHostedAuth(cfg,{now:()=>now,keyResolver:async()=>publicKey,fetch:async(_url,init)=>{
   const posted=new URLSearchParams(String(init?.body));expect(posted.get('code_verifier')).toBe(tx.verifier);expect(posted.get('resource')).toBe(cfg.resource);
   const seconds=now.getTime()/1000;
   const id=await new SignJWT({nonce:tx.nonce,auth_time:seconds,email:'renter@example.invalid',email_verified:true,name:'Synthetic Renter'}).setProtectedHeader({alg:'ES256'}).setIssuer(cfg.issuer).setSubject('renter-subject').setAudience(cfg.clientId).setIssuedAt(seconds).setExpirationTime(seconds+300).sign(privateKey);
   const access=await new SignJWT({client_id:cfg.clientId,jti:'test-token',scope:'quotes:create rental_requests:create rental_requests:read checkout:handoff'}).setProtectedHeader({alg:'ES256',typ:'at+jwt'}).setIssuer(cfg.issuer).setSubject('renter-subject').setAudience(cfg.resource).setIssuedAt(seconds).setNotBefore(seconds).setExpirationTime(seconds+300).sign(privateKey);
   return new Response(JSON.stringify({id_token:id,access_token:access,token_type:'Bearer',expires_in:300}),{headers:{'content-type':'application/json'}});
  }});
  const login=await client.beginLogin(returnTo);tx=await openCookie(key,'transaction',login.cookie,now.getTime());
  await expect(client.completeLogin(new URL(cfg.frontendOrigin+'/api/agent/auth/callback?code=test&state=wrong&iss='+encodeURIComponent(cfg.issuer)),login.cookie)).rejects.toThrow();
  const result=await client.completeLogin(new URL(cfg.frontendOrigin+'/api/agent/auth/callback?code=test&state='+tx.state+'&iss='+encodeURIComponent(cfg.issuer)),login.cookie);
  expect(result.returnTo).toBe(returnTo);const session=await client.readSession(result.cookie);expect(session.subject).toBe('renter-subject');expect(session.profile.emailVerified).toBe(true);expect(JSON.stringify(result)).not.toContain('renter@example.invalid');
 });
});
