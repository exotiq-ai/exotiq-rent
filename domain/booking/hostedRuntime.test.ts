import {describe,it,expect,vi,afterEach} from 'vitest';
import {publicHostedUrl,readHostedBody} from './hostedRuntime.server';
const config={frontendOrigin:'https://rent.example.invalid'};
describe('verified public customer host behind an internal Next URL',()=>{
 it('reconstructs only the exact configured public origin without trusting forwarded headers',()=>{const request=new Request('http://127.0.0.1:3984/api/agent/auth/callback?code=synthetic&state=synthetic&iss=synthetic',{headers:{Host:'rent.example.invalid','X-Forwarded-Host':'evil.invalid','X-Forwarded-Proto':'http'}});expect(publicHostedUrl(request,config,'/api/agent/auth/callback',['code','state','iss']).origin).toBe(config.frontendOrigin);});
 it.each(['evil.invalid','rent.example.invalid:444','rent.example.invalid,evil.invalid',''])('denies unverified Host %s',(host)=>expect(()=>publicHostedUrl(new Request('http://127.0.0.1:3984/api/agent/auth/session',{headers:{Host:host,'X-Forwarded-Host':'rent.example.invalid'}}),config,'/api/agent/auth/session')).toThrow());
 it('rejects path/query/duplicate pollution and protocol-relative reconstruction',()=>{for(const path of ['/api/agent/auth/session?token=x','/api/agent/auth/start?return_to=x&return_to=y','/api/admin','//evil.invalid/api/agent/auth/start'])expect(()=>publicHostedUrl(new Request('http://127.0.0.1:3984'+path,{headers:{Host:'rent.example.invalid'}}),config,'/api/agent/auth/start',['return_to'])).toThrow();});
});
describe('customer inbound body total budget',()=>{
 afterEach(()=>vi.useRealTimers());
 const streamRequest=(stream:ReadableStream<Uint8Array>,signal?:AbortSignal)=>new Request('https://rent.example.invalid/api/agent/customer/quotes/review',{method:'POST',body:stream,signal,duplex:'half'} as RequestInit&{duplex:'half'});
 it('rejects a stalled stream after5s and never waits for cancellation to complete',async()=>{
  vi.useFakeTimers();let controller!:ReadableStreamDefaultController<Uint8Array>;const cancel=vi.fn(()=>new Promise<void>(()=>{}));
  const request=streamRequest(new ReadableStream({start(c){controller=c;},cancel}));let outcome='pending';
  const result=readHostedBody(request).then(()=>{outcome='accepted';},()=>{outcome='rejected';});
  try{await vi.advanceTimersByTimeAsync(5001);expect(outcome).toBe('rejected');expect(cancel).toHaveBeenCalledTimes(1);}finally{try{controller.close();}catch{}await result;}
 });
 it('uses one total deadline even while small chunks keep arriving',async()=>{
  vi.useFakeTimers();let controller!:ReadableStreamDefaultController<Uint8Array>;const request=streamRequest(new ReadableStream({start(c){controller=c;}}));let outcome='pending';
  const result=readHostedBody(request).then(()=>{outcome='accepted';},()=>{outcome='rejected';});
  try{for(let i=0;i<5;i++){controller.enqueue(new TextEncoder().encode(i===0?'{"value":"':'x'));await vi.advanceTimersByTimeAsync(1000);}await vi.advanceTimersByTimeAsync(1);expect(outcome).toBe('rejected');}finally{try{controller.close();}catch{}await result;}
 });
 it.each([true,false])('rejects request abort before or during reading: %s',async before=>{
  let controller!:ReadableStreamDefaultController<Uint8Array>;const abort=new AbortController(),request=streamRequest(new ReadableStream({start(c){controller=c;}}),abort.signal);if(before)abort.abort('private caller detail');let outcome='pending';
  const result=readHostedBody(request).then(()=>{outcome='accepted';},error=>{outcome=error.message;});
  try{if(!before)abort.abort('private caller detail');await new Promise(resolve=>setTimeout(resolve,10));expect(outcome).toBe('Invalid customer request');}finally{try{controller.close();}catch{}await result;}
 });
 it('preserves valid object parsing and rejects oversized/nonobject bodies',async()=>{
  expect(await readHostedBody(new Request('https://rent.example.invalid',{method:'POST',body:'{"action":"continue","csrf":"synthetic"}'}))).toEqual({action:'continue',csrf:'synthetic'});
  for(const body of ['[]','null','{"value":"'+'x'.repeat(65536)+'"}'])await expect(readHostedBody(new Request('https://rent.example.invalid',{method:'POST',body}))).rejects.toThrow();
 });
});
