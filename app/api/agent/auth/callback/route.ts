import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {hostedRuntime,TRANSACTION_COOKIE,CUSTOMER_COOKIE,privateHeaders} from '@/domain/booking/hostedRuntime.server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 let response:NextResponse;
 try{const {config,auth}=hostedRuntime();const result=await auth.completeLogin(new URL(request.url),cookies().get(TRANSACTION_COOKIE)?.value??'');response=NextResponse.redirect(config.frontendOrigin+result.returnTo,303);response.cookies.set(CUSTOMER_COOKIE,result.cookie,{secure:true,httpOnly:true,sameSite:'lax',path:'/',maxAge:Math.max(1,Math.floor((result.expiresAt-Date.now())/1000))});}catch{response=NextResponse.json({error:'Sign-in could not be completed. Open the original review link and sign in again.'},{status:401});}
 response.cookies.set(TRANSACTION_COOKIE,'',{secure:true,httpOnly:true,sameSite:'lax',path:'/',maxAge:0});for(const [k,v] of Object.entries(privateHeaders))response.headers.set(k,v);return response;
}
