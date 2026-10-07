import {describe,it,expect} from 'vitest';
import {accountProviderReturnPath,parseProviderReturnQuery} from './customerProviderReturn';
import {createHostedAuth,openCookie} from './hostedAuth.server';
const operator='10000000-0000-4000-8000-000000000002';
const cookieKey=Buffer.alloc(32,4).toString('base64url');
const config={issuer:'https://identity.example.invalid',authorizationEndpoint:'https://identity.example.invalid/authorize',tokenEndpoint:'https://identity.example.invalid/token',jwksUri:'https://identity.example.invalid/jwks',allowedHosts:['identity.example.invalid'],resource:'https://api.example.invalid/external-booking-api',frontendOrigin:'https://rent.example.invalid',clientId:'hosted-customer',clientSecret:'synthetic-test-only',cookieKey,bridgeKey:Buffer.alloc(32,5).toString('base64url')};
describe('fixed provider return boundary',()=>{
 it('preserves only a safe request reference and action through the encrypted login transaction',async()=>{
  const query={booking_ref:'SYNTHETIC-REQUEST',action:'identity'};
  expect(parseProviderReturnQuery(query)).toEqual({ref:'SYNTHETIC-REQUEST',action:'identity'});
  const destination=accountProviderReturnPath(operator,parseProviderReturnQuery(query)!);
  const login=await createHostedAuth(config).beginLogin(destination);
  expect((await openCookie(cookieKey,'transaction',login.cookie,Date.now())).destination).toBe(destination);
 });
 it('keeps an empty account query as ordinary explicit onboarding',()=>expect(parseProviderReturnQuery({})).toBeNull());
 it.each([{booking_ref:'X'},{action:'checkout'},{booking_ref:'../admin',action:'identity'},{booking_ref:'X',action:'success'},{booking_ref:['X','Y'],action:'identity'},{booking_ref:'X',action:['checkout','identity']},{booking_ref:'X',action:'identity',access_token:'secret'}])('rejects incomplete, duplicate, untrusted or success-claim query %j',query=>expect(()=>parseProviderReturnQuery(query)).toThrow());
 it.each(['?booking_ref=X&action=checkout&token=secret','?booking_ref=X&action=checkout#done','?booking_ref=X&booking_ref=Y&action=checkout','?booking_ref=%2fadmin&action=checkout'])('refuses polluted OAuth return destinations %s',async query=>await expect(createHostedAuth(config).beginLogin('/agent/account/'+operator+query)).rejects.toThrow());
});
