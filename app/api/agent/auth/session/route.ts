import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {hostedRuntime,CUSTOMER_COOKIE,privateHeaders} from '@/domain/booking/hostedRuntime.server';
export const dynamic='force-dynamic';
export async function GET(){
 try{const {auth}=hostedRuntime();const session=await auth.readSession(cookies().get(CUSTOMER_COOKIE)?.value??'');return NextResponse.json({authenticated:true,csrf:session.csrf,expires_at:new Date(session.expiresAt).toISOString(),profile:session.profile},{headers:privateHeaders});}catch{return NextResponse.json({authenticated:false},{status:401,headers:privateHeaders});}
}
