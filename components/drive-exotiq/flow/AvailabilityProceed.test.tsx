// @vitest-environment jsdom
import { act } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
vi.mock('@/components/drive-exotiq/fonts',()=>({driveFontClassName:'test-font'}));
vi.mock('@/components/analytics/CookieControls',()=>({CookieControls:()=>null}));
vi.mock('@/domain/booking/config',async(original)=>({...await original<typeof import('@/domain/booking/config')>(),getDataMode:()=> 'supabase'}));
import { DatesStep } from './DatesStep';
import { ReviewStep } from './ReviewStep';
import { createInitialCart } from '@/domain/booking/mockData';
import { rangeIsBookable } from '@/domain/booking/availability';
import type { BookingCart,AvailabilityAuthority } from '@/domain/booking/types';

const now=new Date('2030-01-01T12:00:00Z');
const known:AvailabilityAuthority={status:'KNOWN',checkedAt:now.toISOString(),windowStart:'2030-01-01',windowEnd:'2030-07-01'};
const unknown:AvailabilityAuthority={status:'UNKNOWN',reason:'upstream_unavailable',retryAfterSeconds:30};
function cart(authority?:AvailabilityAuthority):BookingCart{const c=createInitialCart();return {...c,vehicle:{...c.vehicle,availabilityAuthority:authority,unavailableRanges:[]}};}
let root:Root|undefined;let host:HTMLDivElement;
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(now);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('fetch',vi.fn(()=>{throw Error('Offline network denied');}));host=document.createElement('div');document.body.append(host);});
afterEach(async()=>{if(root){await act(async()=>root!.unmount());root=undefined;}host.remove();vi.useRealTimers();vi.unstubAllGlobals();});
async function mount(element:React.ReactNode){root=createRoot(host);await act(async()=>root!.render(element));}
const button=(label:string)=>Array.from(host.querySelectorAll('button')).find((b)=>b.textContent===label)!;
// Tests explicitly invoke actual component callbacks too: disabled DOM alone
// cannot establish that a captured handler is safe after state changes.
function props(element:Element):any{const key=Object.keys(element).find((k)=>k.startsWith('__reactProps$'));return (element as any)[key!];}

describe('actual calendar and review availability controls',()=>{
  it('rejects missing UNKNOWN outside-window and stale evidence in the shared rule',()=>{
    for(const authority of [undefined,unknown,{...known,windowEnd:'2030-01-01'}, {...known,checkedAt:'2029-12-01T12:00:00Z'}])expect(rangeIsBookable(cart(authority).vehicle,'2030-01-01','2030-01-04','2030-01-01')).toBe(false);
    expect(rangeIsBookable(cart(known).vehicle,'2030-01-01','2030-01-04','2030-01-01')).toBe(true);
  });
  it('renders unknown as unverified, not taken, with disabled Continue and an accessible retry',async()=>{
    const next=vi.fn(),retry=vi.fn();await mount(<DatesStep cart={cart(unknown)} setCart={()=>{}} next={next} onRetryAvailability={retry}/>);
    expect(button('Continue').disabled).toBe(true);expect(host.querySelector('[role="status"]')?.textContent).toMatch(/availability/i);
    expect(host.querySelector('[data-unverified]')).not.toBeNull();expect(host.querySelector('[data-taken]')).toBeNull();
    await act(async()=>props(button('Continue')).onClick());expect(next).not.toHaveBeenCalled();
    await act(async()=>button('Check availability').click());expect(retry).toHaveBeenCalledOnce();
  });
  it('permits known-empty Continue, still rejects a known blocked selected interval',async()=>{
    const next=vi.fn();await mount(<DatesStep cart={cart(known)} setCart={()=>{}} next={next}/>);
    expect(button('Continue').disabled).toBe(false);await act(async()=>button('Continue').click());expect(next).toHaveBeenCalledOnce();
    const blocked=cart(known);blocked.vehicle.unavailableRanges=[{start:blocked.dates.start,end:blocked.dates.end}];
    await act(async()=>root!.render(<DatesStep cart={blocked} setCart={()=>{}} next={next}/>));expect(button('Continue').disabled).toBe(true);
  });
  it('blocks a ready quote and captured request callback on UNKNOWN regardless of accepted terms',async()=>{
    const request=vi.fn();await mount(<ReviewStep cart={cart(unknown)} goTo={()=>{}} onRequest={request} blocked={false} authorityBlocking={true} onRetryAvailability={()=>{}}/>);
    expect(button('Request this booking').disabled).toBe(true);
    await act(async()=>props(button('Request this booking')).onClick());expect(request).not.toHaveBeenCalled();
    expect(host.textContent).toMatch(/availability/i);
  });
  it('keeps unknown notice in server rendering without advertising checked free dates',()=>{
    const html=renderToStaticMarkup(<DatesStep cart={cart(unknown)} setCart={()=>{}} next={()=>{}}/>);
    expect(html).toContain('availability');expect(html).toContain('data-unverified');
  });
});
