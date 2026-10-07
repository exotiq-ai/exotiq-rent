// @vitest-environment jsdom
import {act,createElement} from 'react';import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import AccountPage from '@/app/agent/account/[operatorId]/page';
const operatorId='10000000-0000-4000-8000-000000000002',now=new Date('2030-01-01T12:00:00Z');
let root:Root,host:HTMLDivElement,status:any,session:any,calls:string[],deferred:((value:Response)=>void)|null;
const json=(value:unknown,code=200)=>Response.json(value,{status:code});
const mount=(ref='SYNTHETIC-REQUEST')=>act(async()=>root.render(createElement(AccountPage,{params:Promise.resolve({operatorId}),searchParams:Promise.resolve({booking_ref:ref,action:'checkout'})})));
const props=(e:Element)=>(e as any)[Object.keys(e).find(k=>k.startsWith('__reactProps$'))!];
beforeEach(()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(now);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);calls=[];deferred=null;
 session={authenticated:true,csrf:'synthetic-csrf',expires_at:'2030-01-01T12:10:00Z',profile:{email:'renter@example.invalid',emailVerified:true,name:'Synthetic renter'}};
 status={api_version:'v1',source_checked_at:now.toISOString(),ref:'SYNTHETIC-REQUEST',operator_id:operatorId,operator_name:'Synthetic operator',vehicle_name:'Synthetic touring car',status:'pending_payment',next_action:'await_payment_settlement',hold_expires_at:'2030-01-04T12:00:00Z',payment_due_at:'2030-01-03T12:00:00Z'};
 vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{calls.push(path);expect(init?.method).toBe('GET');if(path==='/api/agent/auth/session')return json(session,session.authenticated?200:401);if(path.startsWith('/api/agent/customer/customers/rental-requests/'))return json(status);throw Error('Offline test forbids unowned network');}));
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.unstubAllGlobals();});
it('reads real customer-owned status only after sign-in and exposes no onboarding or payment success assertion',async()=>{
 await mount();expect(calls).toEqual(['/api/agent/auth/session','/api/agent/customer/customers/rental-requests/SYNTHETIC-REQUEST']);
 for(const text of ['Synthetic operator','Synthetic touring car','pending_payment','Payment settlement is still pending','2030-01-03T12:00:00Z','2030-01-04T12:00:00Z'])expect(host.textContent).toContain(text);
 expect(host.querySelector('input')).toBeNull();expect(host.textContent).toContain('does not confirm payment or identity verification');
});
it.each(['identity','checkout'])('allows a status-only customer to explicitly create their own %s link',async action=>{
 status.next_action=action==='identity'?'verify_identity':'hosted_checkout';status.status=action==='identity'?'pending_documents':'pending_payment';
 const original=fetch;let writes=0;
 vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{if(init?.method==='POST'){writes++;expect(path).toBe('/api/agent/customer/customers/rental-requests/SYNTHETIC-REQUEST/'+action+'-handoff');expect(JSON.parse(init.body as string)).toEqual({csrf:session.csrf,action:'continue'});return json({api_version:'v1',source_checked_at:now.toISOString(),customer_url:location.origin+'/agent/handoff/'+'a'.repeat(43),expires_at:'2030-01-01T12:01:00Z',state:status.status,next_action:status.next_action});}return original(path,init);}));
 await act(async()=>root.render(createElement(AccountPage,{params:Promise.resolve({operatorId}),searchParams:Promise.resolve({ref:'SYNTHETIC-REQUEST'})})));
 expect(host.textContent).toContain('Your rental request');expect(host.textContent).not.toContain('Returned from hosted');expect(writes).toBe(0);
 const button=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Create secure '+(action==='identity'?'identity':'payment')+' link')!;
 expect(button).toBeDefined();await act(async()=>{const first=props(button).onClick;await Promise.all([first(),first()]);});expect(writes).toBe(1);
 expect(host.querySelector('a')?.getAttribute('href')).toBe(location.origin+'/agent/handoff/'+'a'.repeat(43));
 vi.setSystemTime('2030-01-01T12:01:01Z');await act(async()=>root.render(createElement(AccountPage,{params:Promise.resolve({operatorId}),searchParams:Promise.resolve({ref:'SYNTHETIC-REQUEST'})})));expect(host.querySelector('a')).toBeNull();
});
it.each(['wrong-owner','wrong-tenant','UNKNOWN','private-extra'])('hides status on %s result',async fault=>{
 if(fault==='wrong-owner')status.ref='OTHER';if(fault==='wrong-tenant')status.operator_id='10000000-0000-4000-8000-000000000003';if(fault==='UNKNOWN')status.status='UNKNOWN';if(fault==='private-extra')status.provider_url='https://checkout.stripe.com/private';
 await mount();expect(host.textContent).not.toContain('Synthetic touring car');expect(host.querySelector('[role="alert"]')).not.toBeNull();
});
it('does not read private status for missing or expired customer sign-in',async()=>{session.authenticated=false;await mount();expect(calls).toEqual(['/api/agent/auth/session']);expect(host.textContent).not.toContain('Synthetic touring car');expect(host.querySelector('a')).not.toBeNull();});
it('rejects an old in-flight status response after the request ref changes',async()=>{
 const original=fetch;vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>path.endsWith('SYNTHETIC-REQUEST')?new Promise<Response>(resolve=>{deferred=resolve;}):path.endsWith('NEW-REQUEST')?json({...status,ref:'NEW-REQUEST',vehicle_name:'Current vehicle'}):original(path,init)));
 await mount();expect(deferred).not.toBeNull();await mount('NEW-REQUEST');await act(async()=>deferred!(json(status)));expect(host.textContent).toContain('Current vehicle');expect(host.textContent).not.toContain('Synthetic touring car');
});
it('expires a status snapshot and refreshes it with a new owner-checked read',async()=>{
 await mount();vi.setSystemTime('2030-01-01T12:01:01Z');await mount();expect(host.textContent).not.toContain('Synthetic touring car');
 status.source_checked_at=new Date().toISOString();const refresh=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Refresh current status')!;
 await act(async()=>props(refresh).onClick());expect(host.textContent).toContain('Synthetic touring car');
});
