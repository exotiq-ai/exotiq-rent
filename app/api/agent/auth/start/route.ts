import {NextResponse} from 'next/server';
import {hostedRuntime,TRANSACTION_COOKIE,privateHeaders} from '@/domain/booking/hostedRuntime.server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{const {config,auth}=hostedRuntime(),url=new URL(request.url);if(url.origin!==config.frontendOrigin)throw new Error('Invalid origin');const login=await auth.beginLogin(url.searchParams.get('return_to')??'');const response=NextResponse.redirect(login.url,303);for(const [k,v] of Object.entries(privateHeaders))response.headers.set(k,v);response.cookies.set(TRANSACTION_COOKIE,login.cookie,{secure:true,httpOnly:true,sameSite:'lax',path:'/',maxAge:600});return response;}catch{return NextResponse.json({error:'Customer sign-in is not configured or this link is invalid.'},{status:503,headers:privateHeaders});}
}
