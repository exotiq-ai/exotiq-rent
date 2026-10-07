import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {hostedRuntime,CUSTOMER_COOKIE,privateHeaders,publicHostedUrl} from '@/domain/booking/hostedRuntime.server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{const {config,auth}=hostedRuntime();publicHostedUrl(request,config,'/api/agent/auth/session');const session=await auth.readSession((await cookies()).get(CUSTOMER_COOKIE)?.value??'');return NextResponse.json({authenticated:true,csrf:session.csrf,expires_at:new Date(session.expiresAt).toISOString(),profile:session.profile},{headers:privateHeaders});}catch{return NextResponse.json({authenticated:false},{status:401,headers:privateHeaders});}
}
