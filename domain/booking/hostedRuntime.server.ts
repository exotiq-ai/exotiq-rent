import {createHostedAuth,type HostedAuthConfiguration} from './hostedAuth.server';
export const TRANSACTION_COOKIE='__Host-exotiq-transaction';
export const CUSTOMER_COOKIE='__Host-exotiq-customer';
export const privateHeaders={'Cache-Control':'no-store, max-age=0','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; form-action 'self'"};
/** Next may expose an internal address in Request.url behind a HTTPS proxy.
 * Host must match the configured public authority; forwarded headers never
 * choose the origin. Writes additionally require exact Origin and session CSRF. */
export function publicHostedUrl(request:Request,config:Pick<HostedAuthConfiguration,'frontendOrigin'>,path:string,queryKeys:readonly string[]=[]):URL {
 const input=new URL(request.url),front=new URL(config.frontendOrigin);
 if(request.headers.get('host')!==front.host||input.pathname!==path||input.hash)throw new Error('Invalid customer request');
 const seen=new Set<string>();input.searchParams.forEach((_value,key)=>{if(!queryKeys.includes(key)||seen.has(key))throw new Error('Invalid customer request');seen.add(key);});
 return new URL(input.pathname+input.search,front.origin);
}
export function hostedRuntime(){
 const raw=process.env.EXOTIQ_HOSTED_AUTH_CONFIG;if(!raw)throw new Error('Customer authorization unavailable');
 const value=JSON.parse(raw);const config:HostedAuthConfiguration={...value,clientSecret:process.env.EXOTIQ_HOSTED_CLIENT_SECRET??'',cookieKey:process.env.EXOTIQ_HOSTED_COOKIE_KEY??'',bridgeKey:process.env.EXOTIQ_HOSTED_BRIDGE_KEY??''};
 return {config,auth:createHostedAuth(config)};
}
export async function readHostedBody(request:Request):Promise<Record<string,unknown>>{
 const reader=request.body?.getReader();if(!reader)throw new Error('Invalid customer request');let length=0;const chunks:Uint8Array[]=[];
 try{for(;;){const part=await reader.read();if(part.done)break;if(part.value){length+=part.value.byteLength;if(length>65536){await reader.cancel();throw new Error('Invalid customer request');}chunks.push(part.value);}}const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Invalid customer request');return body;}finally{reader.releaseLock();}
}
