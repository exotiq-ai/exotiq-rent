import {BACKEND_STATUSES,type JsonSchema} from './externalContracts.generated';
export const handoffNonce=/^[A-Za-z0-9_-]{43}$/;
export type HandoffAction='identity'|'checkout';
export interface HandoffReview {api_version:'v1';source_checked_at:string;ref:string;operator_name:string;vehicle_name:string;action:HandoffAction;status:typeof BACKEND_STATUSES[number];expires_at:string;}
export interface HandoffResolve {api_version:'v1';source_checked_at:string;action:HandoffAction;provider_url:string;expires_at:string;}
// Exact agreed 14 transport boundary. Regenerate from canonical backend once 14
// lands; this local schema is intentionally strict rather than a partial cast.
const timestamp:JsonSchema={type:'string',format:'date-time',maxLength:35,pattern:'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$'};
const text=(maxLength:number):JsonSchema=>({type:'string',minLength:1,maxLength});
const shared={api_version:{const:'v1'},source_checked_at:timestamp,action:{type:'string',enum:['identity','checkout']},expires_at:timestamp};
const schema=(properties:Record<string,JsonSchema>):JsonSchema=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const reviewSchema=schema({...shared,ref:{...text(80),pattern:'^[A-Za-z0-9_-]+$'},operator_name:text(160),vehicle_name:text(160),status:{type:'string',enum:BACKEND_STATUSES}});
const resolveSchema=schema({...shared,provider_url:{...text(2048),format:'https-url'}});
const unavailable=():never=>{throw new Error('Customer handoff unavailable');};
function validates(schema:JsonSchema,input:unknown):boolean {
 if(!input||typeof input!=='object'||Array.isArray(input))return false;
 const fields=input as Record<string,unknown>,properties=schema.properties!;
 if(Object.keys(fields).length!==Object.keys(properties).length)return false;
 return Object.entries(properties).every(([key,rule])=>{const value=fields[key];if(rule.const!==undefined)return value===rule.const;if(typeof value!=='string'||(rule.minLength!==undefined&&value.length<rule.minLength)||(rule.maxLength!==undefined&&value.length>rule.maxLength)||(rule.enum&&!rule.enum.includes(value))||(rule.pattern&&!new RegExp(rule.pattern).test(value)))return false;return rule.format!=='date-time'||Number.isFinite(Date.parse(value));});
}
function fresh(value:{expires_at:string;source_checked_at:string},now:number){if(!Number.isFinite(now)||Date.parse(value.expires_at)<=now||Date.parse(value.source_checked_at)>now+30000)unavailable();}
export function parseHandoffReview(input:unknown,now=Date.now()):HandoffReview {if(!validates(reviewSchema,input))unavailable();const value=input as HandoffReview;fresh(value,now);return value;}
export function parseHandoffResolve(input:unknown,now=Date.now()):HandoffResolve {
 if(!validates(resolveSchema,input))unavailable();const value=input as HandoffResolve;fresh(value,now);
 const url=new URL(value.provider_url);const host=value.action==='checkout'?'checkout.stripe.com':'verify.stripe.com';
 if(url.protocol!=='https:'||url.hostname!==host||url.username||url.password||url.hash||(url.port&&url.port!=='443'))unavailable();
 url.searchParams.forEach((_value,key)=>{if(/(?:token|secret|credential|confirmation)/i.test(key))unavailable();});
 return value;
}
export function handoffSignIn(nonce:string){if(!handoffNonce.test(nonce))unavailable();return '/api/agent/auth/start?return_to='+encodeURIComponent('/agent/handoff/'+nonce);}
