import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {hostedRuntime,CUSTOMER_COOKIE,privateHeaders,readHostedBody,publicHostedUrl} from '@/domain/booking/hostedRuntime.server';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{const {config,auth}=hostedRuntime();publicHostedUrl(request,config,'/api/agent/auth/logout');const session=await auth.readSession((await cookies()).get(CUSTOMER_COOKIE)?.value??'');const body=await readHostedBody(request);auth.assertCsrf(session,request.headers.get('origin'),typeof body.csrf==='string'?body.csrf:'');const response=new NextResponse(null,{status:204,headers:privateHeaders});response.cookies.set(CUSTOMER_COOKIE,'',{secure:true,httpOnly:true,sameSite:'lax',path:'/',maxAge:0});return response;}catch{return NextResponse.json({error:'Sign-out requires the current customer session.'},{status:403,headers:privateHeaders});}
}
