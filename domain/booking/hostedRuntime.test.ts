import {describe,it,expect} from 'vitest';
import {publicHostedUrl} from './hostedRuntime.server';
const config={frontendOrigin:'https://rent.example.invalid'};
describe('verified public customer host behind an internal Next URL',()=>{
 it('reconstructs only the exact configured public origin without trusting forwarded headers',()=>{const request=new Request('http://127.0.0.1:3984/api/agent/auth/callback?code=synthetic&state=synthetic&iss=synthetic',{headers:{Host:'rent.example.invalid','X-Forwarded-Host':'evil.invalid','X-Forwarded-Proto':'http'}});expect(publicHostedUrl(request,config,'/api/agent/auth/callback',['code','state','iss']).origin).toBe(config.frontendOrigin);});
 it.each(['evil.invalid','rent.example.invalid:444','rent.example.invalid,evil.invalid',''])('denies unverified Host %s',(host)=>expect(()=>publicHostedUrl(new Request('http://127.0.0.1:3984/api/agent/auth/session',{headers:{Host:host,'X-Forwarded-Host':'rent.example.invalid'}}),config,'/api/agent/auth/session')).toThrow());
 it('rejects path/query/duplicate pollution and protocol-relative reconstruction',()=>{for(const path of ['/api/agent/auth/session?token=x','/api/agent/auth/start?return_to=x&return_to=y','/api/admin','//evil.invalid/api/agent/auth/start'])expect(()=>publicHostedUrl(new Request('http://127.0.0.1:3984'+path,{headers:{Host:'rent.example.invalid'}}),config,'/api/agent/auth/start',['return_to'])).toThrow();});
});
