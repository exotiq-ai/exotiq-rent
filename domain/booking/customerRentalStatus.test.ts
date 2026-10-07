import {describe,it,expect} from 'vitest';
import {parseCustomerRentalStatus,customerStatusCurrent} from './customerRentalStatus';
const operator='10000000-0000-4000-8000-000000000002',now=Date.parse('2030-01-01T12:00:00Z');
const record=()=>({api_version:'v1',source_checked_at:new Date(now).toISOString(),ref:'SYNTHETIC-REQUEST',operator_id:operator,operator_name:'Synthetic operator',vehicle_name:'Synthetic car',status:'pending_payment',next_action:'await_payment_settlement',hold_expires_at:null,payment_due_at:'2030-01-03T12:00:00Z'});
describe('canonical current customer-owned status',()=>{
 it('requires exact current ref/operator and retains pending settlement without inferring success',()=>{const parsed=parseCustomerRentalStatus(record(),operator,'SYNTHETIC-REQUEST',now);expect(parsed.next_action).toBe('await_payment_settlement');expect(customerStatusCurrent(parsed,now)).toBe(true);expect(customerStatusCurrent(parsed,now+60001)).toBe(false);});
 it.each([{ref:'OTHER'},{operator_id:'10000000-0000-4000-8000-000000000003'},{status:'UNKNOWN'},{next_action:'success'},{source_checked_at:'2029-12-31T12:00:00Z'},{source_checked_at:'2030-01-01T12:01:00Z'},{confirmation_token:'private'},{provider_url:'https://checkout.stripe.com/pay'}])('fails closed on mismatched, stale or unallowlisted record %j',change=>expect(()=>parseCustomerRentalStatus({...record(),...change},operator,'SYNTHETIC-REQUEST',now)).toThrow());
});
