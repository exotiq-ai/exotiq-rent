import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {hostedRuntime,CUSTOMER_COOKIE,privateHeaders,readHostedBody} from '@/domain/booking/hostedRuntime.server';
import {forwardCustomerHandoff} from '@/domain/booking/customerHandoffServer';
export const dynamic='force-dynamic';
async function bridge(request:Request,context:{params:{nonce:string}},method:'GET'|'POST'){
 try{const {config,auth}=hostedRuntime();const url=new URL(request.url);if(request.headers.get('host')!==new URL(config.frontendOrigin).host||url.search)throw new Error('Invalid request');
  const session=await auth.readSession(cookies().get(CUSTOMER_COOKIE)?.value??'');
  const result=await forwardCustomerHandoff(config,session,context.params.nonce,method,method==='POST'?await readHostedBody(request):null,request.headers.get('origin'));
  return NextResponse.json(result.body,{status:result.status,headers:privateHeaders});
 }catch{return NextResponse.json({code:'handoff_unavailable'},{status:503,headers:privateHeaders});}
}
export const GET=(request:Request,context:{params:{nonce:string}})=>bridge(request,context,'GET');
export const POST=(request:Request,context:{params:{nonce:string}})=>bridge(request,context,'POST');
