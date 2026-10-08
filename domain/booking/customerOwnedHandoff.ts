import {validateContract} from './externalContracts.generated';
export type CustomerHandoffAction='identity'|'checkout';
export interface CustomerOwnedHandoff {api_version:'v1';source_checked_at:string;customer_url:string;expires_at:string;state:'pending_documents'|'pending_payment';next_action:'verify_identity'|'hosted_checkout';}
/** A first-party opaque rendezvous is the only browser result of this action. */
export function parseCustomerOwnedHandoff(value:unknown,action:CustomerHandoffAction,origin:string,now=Date.now()):CustomerOwnedHandoff {
 if(!validateContract(action==='identity'?'IdentityHandoffResult':'CheckoutHandoffResult',value).ok)throw Error('Secure customer link unavailable.');
 const result=value as CustomerOwnedHandoff,url=new URL(result.customer_url),checked=Date.parse(result.source_checked_at);
 if(url.origin!==origin||url.username||url.password||url.search||url.hash||!/^\/agent\/handoff\/[A-Za-z0-9_-]{43}$/.test(url.pathname)||!Number.isFinite(now)||checked>now+30000||now-checked>60000||Date.parse(result.expires_at)<=now)throw Error('Secure customer link unavailable.');
 return result;
}
