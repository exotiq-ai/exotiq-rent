// Synthetic local fixture only. This exercises the real Next SSR/BFF, cookie
// decryption, remote JWKS JWT verification and signed bridge. It is not a backend
// SQL/provider staging substitute. Listen exclusively on loopback.
import https from 'node:https';import http from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';import {execFileSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';import {createHash,randomBytes} from 'node:crypto';
import {generateKeyPair,exportJWK,SignJWT,jwtVerify} from 'jose';
import {sealCookie} from '../../domain/booking/hostedAuth.server.ts';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=root+'output/playwright/handoff/';
await mkdir(out,{recursive:true});
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',out+'key.pem','-out',out+'cert.pem','-days','1','-subj','/CN=rent.synthetic.invalid','-addext','subjectAltName=DNS:rent.synthetic.invalid,DNS:identity.synthetic.invalid,DNS:api.synthetic.invalid,IP:127.0.0.1'],{stdio:'ignore'});
const tls={key:await readFile(out+'key.pem'),cert:await readFile(out+'cert.pem')};
const keyPair=await generateKeyPair('ES256'),publicJwk={...await exportJWK(keyPair.publicKey),kid:'local-synthetic',use:'sig',alg:'ES256'};
const cookieKey=randomBytes(32).toString('base64url'),bridgeKey=randomBytes(32).toString('base64url');
const cfg={issuer:'https://identity.synthetic.invalid',authorizationEndpoint:'https://identity.synthetic.invalid/authorize',tokenEndpoint:'https://identity.synthetic.invalid/token',jwksUri:'https://identity.synthetic.invalid/jwks',allowedHosts:['identity.synthetic.invalid'],resource:'https://api.synthetic.invalid/external-booking-api',frontendOrigin:'https://rent.synthetic.invalid:9444',clientId:'local-hosted-customer'};
let resolves=0;const targets=new Map();const hash=s=>createHash('sha256').update(s).digest('hex');
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(value));}
async function text(req){let result='';for await(const part of req){result+=part;if(result.length>65536)throw Error();}return result;}
const fixture=https.createServer(tls,async(req,res)=>{
 try{const url=new URL(req.url,'https://127.0.0.1:9443');
  if(url.pathname==='/jwks')return json(res,200,{keys:[publicJwk]});
  if(url.pathname==='/__test/session'){
   const sub=url.searchParams.get('subject')??'renter',now=Math.floor(Date.now()/1000),expiry=now+300;
   const token=await new SignJWT({client_id:cfg.clientId,jti:randomBytes(12).toString('hex'),scope:'rental_requests:read checkout:handoff'}).setProtectedHeader({alg:'ES256',typ:'at+jwt',kid:publicJwk.kid}).setIssuer(cfg.issuer).setSubject(sub).setAudience(cfg.resource).setIssuedAt(now).setNotBefore(now).setExpirationTime(expiry).sign(keyPair.privateKey);
   const session={issuer:cfg.issuer,subject:sub,clientId:cfg.clientId,accessToken:token,expiresAt:expiry*1000,csrf:randomBytes(24).toString('base64url'),profile:{email:'renter@synthetic.invalid',emailVerified:true,name:'Synthetic renter'}};
   return json(res,200,{cookie:await sealCookie(cookieKey,'session',session,session.expiresAt)});
  }
  if(url.pathname==='/__test/count')return json(res,200,{resolves,providerSessions:targets.size});
  const matched=/^\/external-booking-api\/v1\/customer-handoffs\/([A-Za-z0-9_-]{43})\/(review|resolve)$/.exec(url.pathname);if(!matched)return json(res,404,{});
  const raw=await text(req),token=String(req.headers.authorization??'').replace(/^Bearer /,'');
  const access=await jwtVerify(token,keyPair.publicKey,{issuer:cfg.issuer,audience:cfg.resource,algorithms:['ES256']});
  const proof=await jwtVerify(String(req.headers['x-exotiq-hosted-proof']??''),Buffer.from(bridgeKey,'base64url'),{issuer:cfg.frontendOrigin,audience:cfg.resource,algorithms:['HS256']});
  if(proof.payload.provider_subject!==access.payload.sub||proof.payload.path!==url.pathname||proof.payload.method!==req.method||proof.payload.body_hash!==hash(raw)||proof.payload.token_hash!==hash(token))return json(res,403,{message:'private invalid proof'});
  if(access.payload.sub!=='renter')return json(res,404,{message:'private other customer'});
  if(matched[1]==='e'.repeat(43))return json(res,410,{message:'private expired record'});
  const action=matched[1]==='i'.repeat(43)?'identity':'checkout',stamp=new Date().toISOString(),expires_at=new Date(Date.now()+60000).toISOString();
  if(matched[2]==='review'&&req.method==='GET')return json(res,200,{api_version:'v1',source_checked_at:stamp,ref:'LOCAL-RENT-1',operator_name:'Synthetic local operator',vehicle_name:'Synthetic touring car',action,status:action==='identity'?'pending_documents':'pending_payment',expires_at});
  if(req.method!=='POST'||raw!==JSON.stringify({action:'continue'}))return json(res,400,{});
  resolves++;if(!targets.has(matched[1]))targets.set(matched[1],`https://${action==='identity'?'verify':'checkout'}.stripe.com/${action==='identity'?'start':'c/pay'}/synthetic-local`);
  return json(res,200,{api_version:'v1',source_checked_at:stamp,action,provider_url:targets.get(matched[1]),expires_at});
 }catch{return json(res,503,{code:'synthetic_unavailable'});}
});
await new Promise(resolve=>fixture.listen(9443,'127.0.0.1',resolve));
const child=spawn(process.execPath,[root+'node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3984'],{cwd:root,env:{...process.env,NODE_OPTIONS:`--require "${root}tests/agent/handoff-fetch-preload.cjs"`,NODE_EXTRA_CA_CERTS:out+'cert.pem',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_MOCK_MODE:'true',EXOTIQ_HOSTED_AUTH_CONFIG:JSON.stringify(cfg),EXOTIQ_HOSTED_CLIENT_SECRET:'local-synthetic-only',EXOTIQ_HOSTED_COOKIE_KEY:cookieKey,EXOTIQ_HOSTED_BRIDGE_KEY:bridgeKey},stdio:['ignore','pipe','pipe']});
const redact=data=>process.stdout.write(String(data).replace(/[A-Za-z0-9_-]{43,}/g,'[redacted]'));
child.stdout.on('data',redact);child.stderr.on('data',redact);
const proxy=https.createServer(tls,(req,res)=>{const upstream=http.request({hostname:'127.0.0.1',port:3984,path:req.url,method:req.method,headers:{...req.headers,'x-forwarded-proto':'https','x-forwarded-host':'rent.synthetic.invalid:9444'}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});upstream.on('error',()=>{res.writeHead(503);res.end('Starting local fixture');});req.pipe(upstream);});
await new Promise(resolve=>proxy.listen(9444,'127.0.0.1',resolve));
const close=()=>{child.kill('SIGTERM');proxy.close();fixture.close();};process.on('SIGINT',close);process.on('SIGTERM',close);child.on('exit',()=>{proxy.close();fixture.close();});
