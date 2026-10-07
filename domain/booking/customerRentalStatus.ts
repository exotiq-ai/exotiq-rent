import {BACKEND_STATUSES,NEXT_ACTIONS,validateContract} from './externalContracts.generated';
import {ownedUuid,type CustomerSession} from './externalContracts';
import {customerFetch} from './externalConsent';
import {parseCustomerOwnedHandoff,type CustomerHandoffAction} from './customerOwnedHandoff';
export interface CustomerRentalStatus {
 api_version:'v1';source_checked_at:string;ref:string;operator_id:string;operator_name:string;vehicle_name:string;
 status:typeof BACKEND_STATUSES[number];next_action:typeof NEXT_ACTIONS[number];hold_expires_at:string|null;payment_due_at:string|null;
}
export function customerStatusCurrent(value:CustomerRentalStatus,now=Date.now()):boolean {
 const checked=Date.parse(value.source_checked_at);return Number.isFinite(now)&&Number.isFinite(checked)&&checked<=now+30000&&now-checked<=60000;
}
export function parseCustomerRentalStatus(value:unknown,operatorId:string,ref:string,now=Date.now()):CustomerRentalStatus {
 if(!ownedUuid(operatorId)||!/^[A-Za-z0-9_-]{1,80}$/.test(ref)||!validateContract('CustomerRentalStatusResult',value).ok)throw Error('The current rental status could not be confirmed.');
 const record=value as CustomerRentalStatus;
 if(record.operator_id!==operatorId||record.ref!==ref||!customerStatusCurrent(record,now))throw Error('The current rental status could not be confirmed.');
 return record;
}
export async function readCustomerRentalStatus(operatorId:string,ref:string):Promise<CustomerRentalStatus> {
 if(!ownedUuid(operatorId)||!/^[A-Za-z0-9_-]{1,80}$/.test(ref))throw Error('Invalid customer rental request.');
 return parseCustomerRentalStatus(await customerFetch('/api/agent/customer/customers/rental-requests/'+ref),operatorId,ref);
}
export async function createCustomerRentalHandoff(status:CustomerRentalStatus,session:CustomerSession,action:CustomerHandoffAction){
 const expected=action==='identity'?'verify_identity':'hosted_checkout';
 parseCustomerRentalStatus(status,status.operator_id,status.ref);
 if(status.next_action!==expected||Date.parse(session.expires_at)<=Date.now())throw Error('Refresh your customer sign-in and current rental status before continuing.');
 const output=await customerFetch('/api/agent/customer/customers/rental-requests/'+status.ref+'/'+action+'-handoff',{csrf:session.csrf,action:'continue'},201);
 if(!customerStatusCurrent(status)||Date.parse(session.expires_at)<=Date.now())throw Error('Refresh your customer sign-in and current rental status before continuing.');
 return parseCustomerOwnedHandoff(output,action,location.origin);
}
export const customerNextAction:Record<CustomerRentalStatus['next_action'],string>={
 verify_identity:'Complete identity verification using a fresh secure customer link.',
 await_operator:'Waiting for operator approval.',hosted_checkout:'Complete the hosted payment steps using a fresh secure customer link.',
 await_payment_settlement:'Payment settlement is still pending.',await_reconciliation:'Payment confirmation is still being reconciled.',
 confirmed:'Your rental is confirmed.',rental_active:'Your rental is active.',declined:'The operator declined this request.',cancelled:'This rental request is cancelled.',
 expired:'The payment window expired.',completed:'This rental is complete.',refunded:'This rental is refunded.',recover_authorization:'Reauthorize your agent if you want it to access this request again.',
};
