// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://rent.example.invalid"}
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import Landing from '@/app/agent/handoff/[nonce]/CustomerHandoffLanding';
const nonce='a'.repeat(43),other='b'.repeat(43),now=Date.now();
const review={api_version:'v1' as const,source_checked_at:new Date(now).toISOString(),ref:'RENT-1',operator_name:'Synthetic operator',vehicle_name:'Synthetic car',action:'checkout' as const,status:'pending_payment' as const,expires_at:new Date(now+60000).toISOString()};
let root:Root,host:HTMLDivElement;
const props=(e:Element)=>(e as any)[Object.keys(e).find(k=>k.startsWith('__reactProps$'))!];
const button=()=>Array.from(host.querySelectorAll('button')).find(e=>e.textContent==='Continue securely')!;
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(now);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);vi.stubGlobal('fetch',vi.fn(async()=>Response.json({api_version:'v1',source_checked_at:new Date(now).toISOString(),action:'checkout',provider_url:'https://checkout.stripe.com/c/pay/synthetic',expires_at:new Date(now+60000).toISOString()})));});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.unstubAllGlobals();});
const mount=(data:any=review)=>act(async()=>root.render(createElement(Landing,{nonce,review:data,csrf:'synthetic-csrf',sessionExpiresAt:now+60000})));
it.each(['grant_expired','grant_revoked'])('offers explicit %s review recovery without auto POST or consent',async code=>{
 const id='10000000-0000-4000-8000-000000000002';vi.stubGlobal('fetch',vi.fn(async()=>Response.json({api_version:'v1',source_checked_at:new Date(now).toISOString(),renewal_id:id,state:'authorization_required',customer_url:location.origin+'/agent/authorization/'+id,expires_at:new Date(now+60000).toISOString()},{status:201})));
 await act(async()=>root.render(createElement(Landing,{nonce,review:null,csrf:'synthetic-csrf',sessionExpiresAt:now+60000,recoveryCode:code as any})));
 expect(fetch).not.toHaveBeenCalled();const recovery=Array.from(host.querySelectorAll('button')).find(e=>e.textContent==='Review agent access')!;expect(recovery).toBeDefined();
 await act(async()=>{const click=props(recovery).onClick;await Promise.all([click(),click()]);});expect(fetch).toHaveBeenCalledTimes(1);
 expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/agent/customer/customer-handoffs/'+nonce+'/grant-renewals');expect(host.querySelector('a')?.getAttribute('href')).toBe(location.origin+'/agent/authorization/'+id);expect(host.textContent).not.toContain('Agent access authorized');
});
it('can enter safe recovery after explicit resolve reports a current revoked grant',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({code:'grant_revoked'},{status:409})));await mount();await act(async()=>props(button()).onClick());
 expect(fetch).toHaveBeenCalledTimes(1);expect(Array.from(host.querySelectorAll('button')).some(e=>e.textContent==='Review agent access')).toBe(true);expect(host.querySelector('a')).toBeNull();
});
it('a captured recovery handler cannot submit after session expiry or nonce replacement',async()=>{
 await act(async()=>root.render(createElement(Landing,{nonce,review:null,csrf:'synthetic-csrf',sessionExpiresAt:now+60000,recoveryCode:'grant_revoked'})));
 const captured=props(Array.from(host.querySelectorAll('button')).find(e=>e.textContent==='Review agent access')!).onClick;
 vi.setSystemTime(now+60001);await act(async()=>captured());expect(fetch).not.toHaveBeenCalled();vi.setSystemTime(now);
 await act(async()=>root.render(createElement(Landing,{nonce:other,review:null,csrf:'synthetic-csrf',sessionExpiresAt:now+60000,recoveryCode:'grant_expired'})));await act(async()=>captured());expect(fetch).not.toHaveBeenCalled();
});
it('hides a late renewal response after navigation and never invokes consent completion',async()=>{
 let finish!:(r:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>finish=resolve)));
 await act(async()=>root.render(createElement(Landing,{nonce,review:null,csrf:'synthetic-csrf',sessionExpiresAt:now+60000,recoveryCode:'grant_expired'})));let promise:Promise<void>;
 await act(async()=>{promise=props(Array.from(host.querySelectorAll('button')).find(e=>e.textContent==='Review agent access')!).onClick();});
 await act(async()=>root.render(createElement(Landing,{nonce:other,review:null,csrf:'synthetic-csrf',sessionExpiresAt:now+60000,recoveryCode:'grant_revoked'})));
 await act(async()=>{finish(Response.json({api_version:'v1',source_checked_at:new Date(now).toISOString(),renewal_id:'10000000-0000-4000-8000-000000000002',state:'authorization_required',customer_url:location.origin+'/agent/authorization/10000000-0000-4000-8000-000000000002',expires_at:new Date(now+60000).toISOString()},{status:201}));await promise;});expect(fetch).toHaveBeenCalledTimes(1);expect(host.querySelector('a')).toBeNull();
});
it('keeps server-rendered continuation disabled until the client lifecycle is initialized',()=>{const html=renderToStaticMarkup(createElement(Landing,{nonce,review,csrf:'synthetic-csrf',sessionExpiresAt:now+60000}));expect(html).toMatch(/<button[^>]*disabled=""/);});
it('shows server-reviewed request and makes exactly one explicit continuation without browser authority tokens',async()=>{await mount();expect(host.textContent).toContain('Synthetic operator');expect(host.textContent).toContain('pending payment');expect(vi.mocked(fetch)).not.toHaveBeenCalled();const click=props(button()).onClick;await act(async()=>{click();click();});expect(fetch).toHaveBeenCalledTimes(1);expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({csrf:'synthetic-csrf',action:'continue'});const link=host.querySelector('a')!;expect(link.href).toBe('https://checkout.stripe.com/c/pay/synthetic');expect(link.rel).toContain('noreferrer');expect(host.innerHTML).not.toMatch(/Bearer|access_token|confirmation_token/);});
it('has no continue for missing or malformed server review',async()=>{await mount(null);expect(button()).toBeUndefined();await mount({...review,status:'UNKNOWN'});expect(button()).toBeUndefined();expect(fetch).not.toHaveBeenCalled();});
it('checks expired session and handoff inside a previously captured handler',async()=>{await mount();const click=props(button()).onClick;vi.setSystemTime(now+60001);await act(async()=>click());expect(fetch).not.toHaveBeenCalled();expect(button()).toBeUndefined();});
it('refuses wrong provider action and hides upstream private errors',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>Response.json({message:'private customer',confirmation_token:'secret'},{status:404})));await mount();await act(async()=>props(button()).onClick());expect(host.querySelector('a')).toBeNull();expect(host.textContent).not.toContain('private customer');expect(host.textContent).toMatch(/retry|unavailable/i);});
it('route replacement invalidates captured continuation and late provider response',async()=>{let finish!:(r:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>finish=resolve)));await mount();const click=props(button()).onClick;await act(async()=>{void click();});await act(async()=>root.render(createElement(Landing,{nonce:other,review,csrf:'synthetic-csrf',sessionExpiresAt:now+60000})));await act(async()=>{await click();finish(Response.json({api_version:'v1',source_checked_at:new Date(now).toISOString(),action:'checkout',provider_url:'https://checkout.stripe.com/c/pay/synthetic',expires_at:new Date(now+60000).toISOString()}));});expect(fetch).toHaveBeenCalledTimes(1);expect(host.querySelector('a')).toBeNull();});
it('aborts a hung continuation and leaves a safe retry instead of stuck loading',async()=>{vi.useFakeTimers();vi.setSystemTime(now);let signal:AbortSignal|undefined;vi.stubGlobal('fetch',vi.fn((_url,init)=>{signal=init.signal;return new Promise((_resolve,reject)=>signal!.addEventListener('abort',()=>reject(Error('offline timeout')),{once:true}));}));await mount();await act(async()=>{void props(button()).onClick();});await act(async()=>vi.advanceTimersByTimeAsync(10001));expect(signal?.aborted).toBe(true);expect(button().disabled).toBe(false);expect(host.textContent).toContain('Retry');expect(host.querySelector('a')).toBeNull();});
import {renderToStaticMarkup} from 'react-dom/server';
