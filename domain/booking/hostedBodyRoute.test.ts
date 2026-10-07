import {it,expect,vi} from 'vitest';
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>({value:'synthetic-encrypted-cookie'})})}));
vi.mock('./hostedRuntime.server',async original=>({...await original<typeof import('./hostedRuntime.server')>(),hostedRuntime:()=>({config:{frontendOrigin:'https://rent.example.invalid'},auth:{readSession:async()=>({expiresAt:Date.now()+60000})}})}));
vi.mock('./customerHandoffServer',()=>({forwardCustomerHandoff:vi.fn(()=>{throw Error('Unexpected backend call');})}));
import {POST} from '../../app/api/agent/handoff/[nonce]/route';
import {forwardCustomerHandoff} from './customerHandoffServer';
it('actual handoff BFF returns private generic503 for stalled body without forwarding',async()=>{
 vi.useFakeTimers();let controller!:ReadableStreamDefaultController<Uint8Array>;const nonce='a'.repeat(43),cancel=vi.fn(()=>new Promise<void>(()=>{}));
 const request=new Request('http://127.0.0.1/api/agent/handoff/'+nonce,{method:'POST',headers:{host:'rent.example.invalid',origin:'https://rent.example.invalid','content-type':'application/json'},body:new ReadableStream({start(c){controller=c;},cancel}),duplex:'half'} as RequestInit&{duplex:'half'});
 let response:Response|undefined;const operation=POST(request,{params:Promise.resolve({nonce})}).then(value=>{response=value;});
 try{await vi.advanceTimersByTimeAsync(5001);expect(response?.status).toBe(503);expect(await response!.json()).toEqual({code:'handoff_unavailable'});expect(response!.headers.get('cache-control')).toContain('no-store');expect(response!.headers.get('referrer-policy')).toBe('no-referrer');expect(forwardCustomerHandoff).not.toHaveBeenCalled();expect(cancel).toHaveBeenCalled();}finally{try{controller.close();}catch{}await operation;vi.useRealTimers();}
});
