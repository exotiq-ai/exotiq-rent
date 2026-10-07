import {BACKEND_STATUSES,validateContract} from './externalContracts.generated';
export const handoffNonce=/^[A-Za-z0-9_-]{43}$/;
export type HandoffAction='identity'|'checkout';
export interface HandoffReview {api_version:'v1';source_checked_at:string;ref:string;operator_name:string;vehicle_name:string;action:HandoffAction;status:typeof BACKEND_STATUSES[number];expires_at:string;}
export interface HandoffResolve {api_version:'v1';source_checked_at:string;action:HandoffAction;provider_url:string;expires_at:string;}
const unavailable=():never=>{throw new Error('Customer handoff unavailable');};
function fresh(value:{expires_at:string;source_checked_at:string},now:number){if(!Number.isFinite(now)||Date.parse(value.expires_at)<=now||Date.parse(value.source_checked_at)>now+30000)unavailable();}
export function parseHandoffReview(input:unknown,now=Date.now()):HandoffReview {if(!validateContract('CustomerHandoffReviewResult',input).ok)unavailable();const value=input as HandoffReview;fresh(value,now);return value;}
export function parseHandoffResolve(input:unknown,now=Date.now()):HandoffResolve {
 if(!validateContract('CustomerHandoffResolveResult',input).ok)unavailable();const value=input as HandoffResolve;fresh(value,now);
 return value;
}
export function handoffSignIn(nonce:string){if(!handoffNonce.test(nonce))unavailable();return '/api/agent/auth/start?return_to='+encodeURIComponent('/agent/handoff/'+nonce);}
