export interface ProviderReturn {ref:string;action:'identity'|'checkout';}
export type CustomerAccountView=ProviderReturn|{ref:string;action:null};
const reference=/^[A-Za-z0-9_-]{1,80}$/;
const operator=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseProviderReturnQuery(query:Record<string,string|string[]|undefined>):ProviderReturn|null {
 const keys=Object.keys(query);
 if(keys.length===0)return null;
 if(keys.length!==2||!keys.includes('booking_ref')||!keys.includes('action')||typeof query.booking_ref!=='string'||!reference.test(query.booking_ref)||(query.action!=='identity'&&query.action!=='checkout'))throw Error('Invalid provider return.');
 return {ref:query.booking_ref,action:query.action};
}
export function parseCustomerAccountQuery(query:Record<string,string|string[]|undefined>):CustomerAccountView|null {
 if(Object.keys(query).length===1&&typeof query.ref==='string'&&reference.test(query.ref))return {ref:query.ref,action:null};
 return parseProviderReturnQuery(query);
}
export function accountProviderReturnPath(operatorId:string,value:CustomerAccountView):string {
 if(operator.test(operatorId)&&reference.test(value.ref)&&value.action===null)return `/agent/account/${operatorId}?ref=${value.ref}`;
 if(!operator.test(operatorId)||!reference.test(value.ref)||(value.action!=='identity'&&value.action!=='checkout'))throw Error('Invalid provider return.');
 return `/agent/account/${operatorId}?booking_ref=${value.ref}&action=${value.action}`;
}
