import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {hostedRuntime,CUSTOMER_COOKIE,privateHeaders,readHostedBody} from '@/domain/booking/hostedRuntime.server';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{const {auth}=hostedRuntime();const session=await auth.readSession(cookies().get(CUSTOMER_COOKIE)?.value??'');const body=await readHostedBody(request);auth.assertCsrf(session,request.headers.get('origin'),typeof body.csrf==='string'?body.csrf:'');const response=new NextResponse(null,{status:204,headers:privateHeaders});response.cookies.set(CUSTOMER_COOKIE,'',{secure:true,httpOnly:true,sameSite:'lax',path:'/',maxAge:0});return response;}catch{return NextResponse.json({error:'Sign-out requires the current customer session.'},{status:403,headers:privateHeaders});}
}
