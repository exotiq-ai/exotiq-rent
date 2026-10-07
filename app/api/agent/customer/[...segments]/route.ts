import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {hostedRuntime,CUSTOMER_COOKIE,privateHeaders,readHostedBody} from '@/domain/booking/hostedRuntime.server';
import {forwardHostedRequest} from '@/domain/booking/hostedProxy.server';
export const dynamic='force-dynamic';
async function bridge(request:Request,context:{params:{segments:string[]}},method:'GET'|'POST'){
 try{const {config,auth}=hostedRuntime();if(new URL(request.url).origin!==config.frontendOrigin||new URL(request.url).search)throw new Error('Invalid customer origin');const session=await auth.readSession(cookies().get(CUSTOMER_COOKIE)?.value??'');const path=context.params.segments.join('/');const result=await forwardHostedRequest(config,session,method,path,method==='POST'?await readHostedBody(request):null,request.headers.get('origin'));return result.status===204?new NextResponse(null,{status:204,headers:privateHeaders}):NextResponse.json(result.body,{status:result.status,headers:privateHeaders});}catch{return NextResponse.json({error:'This customer request could not be completed. Sign in again or retry.'},{status:503,headers:privateHeaders});}
}
export const GET=(request:Request,context:{params:{segments:string[]}})=>bridge(request,context,'GET');
export const POST=(request:Request,context:{params:{segments:string[]}})=>bridge(request,context,'POST');
