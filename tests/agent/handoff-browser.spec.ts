import {test,expect,type BrowserContext} from '@playwright/test';
import {quoteId} from './customer-fixtures.mjs';
const nonce='a'.repeat(43),origin='https://rent.synthetic.invalid:9444';
async function login(context:BrowserContext,subject='renter'){const response=await context.request.get('https://127.0.0.1:9443/__test/session?subject='+subject);expect(response.ok()).toBe(true);const {cookie}=await response.json();await context.addCookies([{name:'__Host-exotiq-customer',value:cookie,url:origin,httpOnly:true,secure:true,sameSite:'Lax'}]);}
test.beforeEach(async({context})=>{await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin===origin||url.origin==='https://identity.synthetic.invalid')return route.continue();return route.abort('blockedbyclient');});});
test('actual SSR and BFF require a fresh cookie, then explicit continue produces a private validated provider link',async({page,context})=>{
 await page.goto('/agent/handoff/'+nonce);await expect(page.getByRole('link',{name:'Sign in securely'})).toHaveAttribute('href','/api/agent/auth/start?return_to='+encodeURIComponent('/agent/handoff/'+nonce));
 await expect(page.getByRole('button',{name:'Continue securely'})).toHaveCount(0);
 await login(context);const before=await(await context.request.get('https://127.0.0.1:9443/__test/count')).json();
 await page.goto('/agent/handoff/'+nonce);await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content','no-referrer');
 await expect(page.getByText('Synthetic local operator',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Continue securely'})).toBeVisible();
 expect((await(await context.request.get('https://127.0.0.1:9443/__test/count')).json()).resolves).toBe(before.resolves);
 await page.getByRole('button',{name:'Continue securely'}).click();const link=page.getByRole('link',{name:'Open Stripe securely'});await expect(link).toHaveAttribute('href','https://checkout.stripe.com/c/pay/synthetic-local');
 let referrer:string|undefined;await context.route('https://checkout.stripe.com/**',async route=>{referrer=route.request().headers().referer;await route.fulfill({contentType:'text/html',body:'<h1>Synthetic hosted provider destination</h1>'});});
 await link.click();await expect(page.getByRole('heading',{name:'Synthetic hosted provider destination'})).toBeVisible();expect(referrer).toBeUndefined();expect(page.url()).not.toContain(nonce);
});
test('wrong customer, expired link and tampered cookie cannot reveal the current request or resolve provider sessions',async({page,context})=>{
 await login(context,'other-customer');await page.goto('/agent/handoff/'+nonce);await expect(page.getByRole('button',{name:'Continue securely'})).toHaveCount(0);await expect(page.getByText('Synthetic local operator')).toHaveCount(0);expect(await page.content()).not.toContain('private other customer');
 await login(context);await page.goto('/agent/handoff/'+'e'.repeat(43));await expect(page.getByRole('button',{name:'Continue securely'})).toHaveCount(0);
 await context.clearCookies();await context.addCookies([{name:'__Host-exotiq-customer',value:'tampered',url:origin,httpOnly:true,secure:true}]);const denied=await page.evaluate(async(path)=>{const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({csrf:'wrong',action:'continue'})});return {status:r.status,body:await r.text()};},'/api/agent/handoff/'+nonce);expect(denied.status).toBe(503);expect(denied.body).not.toContain('provider_url');
});
test('retry reuses the local provider session and CSRF/extra fields cannot create a session',async({page,context})=>{
 await login(context);await page.goto('/agent/handoff/'+'r'.repeat(43));
 const denied=await page.evaluate(async(path)=>{const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({csrf:'wrong',action:'continue',customer_id:'other'})});return r.status;},'/api/agent/handoff/'+'r'.repeat(43));expect(denied).toBe(503);
 await page.getByRole('button',{name:'Continue securely'}).click();const first=await page.getByRole('link',{name:'Open Stripe securely'}).getAttribute('href');await page.reload();await page.getByRole('button',{name:'Continue securely'}).click();await expect(page.getByRole('link',{name:'Open Stripe securely'})).toHaveAttribute('href',first!);
});
test('identity uses a separate strict hosted provider destination',async({page,context})=>{await login(context);await page.goto('/agent/handoff/'+'i'.repeat(43));await expect(page.getByText('Verify your identity with Stripe.')).toBeVisible();await page.getByRole('button',{name:'Continue securely'}).click();await expect(page.getByRole('link',{name:'Open Stripe securely'})).toHaveAttribute('href','https://verify.stripe.com/start/synthetic-local');});
for(const action of ['identity','checkout'])test('customer can create their own '+action+' link through the real account/BFF without agent delegation',async({page})=>{
 const ref='CUSTOMER-'+action.toUpperCase(),path='/agent/account/10000000-0000-4000-8000-000000000002?ref='+ref;
 const account=await (await page.request.get('https://127.0.0.1:9443/__test/customer-account?ref='+ref)).json();expect(account.action_scopes).toEqual(['rental_requests:read']);expect(account.links.customer_account).toBe(origin+path);await page.goto(account.links.customer_account);await page.getByRole('link',{name:'Sign in to review your rental request'}).click();
 await expect(page).toHaveURL(origin+path);await expect(page.getByRole('heading',{name:'Your rental request',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Create secure '+(action==='identity'?'identity':'payment')+' link'}).click();
 const link=page.getByRole('link',{name:'Review secure '+(action==='identity'?'identity':'payment')+' link'});await expect(link).toHaveAttribute('href',origin+'/agent/handoff/'+(action==='identity'?'j':'k').repeat(43));
 const denied=await page.evaluate(async({ref})=>{const session=await (await fetch('/api/agent/auth/session')).json();const response=await fetch('/api/agent/customer/customers/rental-requests/'+ref+'/identity-handoff',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({csrf:session.csrf,action:'continue',customer_id:'other'})});return response.status;},{ref});expect(denied).toBe(503);
 await link.click();await page.getByRole('button',{name:'Continue securely'}).click();await expect(page.getByRole('link',{name:'Open Stripe securely'})).toHaveAttribute('href',action==='identity'?'https://verify.stripe.com/start/synthetic-local':'https://checkout.stripe.com/c/pay/synthetic-local');
});
for(const code of ['grant_expired','grant_revoked'])test('nonce '+code+' starts only an explicit original-agent review and consent',async({page,context})=>{
 await login(context);const before=await(await context.request.get('https://127.0.0.1:9443/__test/count')).json();
 await page.goto('/agent/handoff/'+(code==='grant_expired'?'x':'v').repeat(43));const button=page.getByRole('button',{name:'Review agent access'});await expect(button).toBeVisible();
 expect((await(await context.request.get('https://127.0.0.1:9443/__test/count')).json()).grantRenewals).toBe(before.grantRenewals);
 await button.click();const link=page.getByRole('link',{name:'Open agent authorization review'});await expect(link).toHaveAttribute('href',origin+'/agent/authorization/10000000-0000-4000-8000-000000000006');
 expect((await(await context.request.get('https://127.0.0.1:9443/__test/count')).json()).renewalCompletes).toBe(before.renewalCompletes);
 await link.click();await expect(page.getByText('Agent application: synthetic-original-agent')).toBeVisible();await expect(page.getByText('Read this rental request’s status',{exact:true})).toBeVisible();await expect(page.getByText('Open customer-hosted identity verification for this rental',{exact:true})).toBeVisible();await expect(page.getByText('Open customer-hosted checkout for this rental',{exact:true})).toHaveCount(0);
 const authorize=page.getByRole('button',{name:code==='grant_revoked'?'Authorize new agent access':'Reauthorize agent access'});await expect(authorize).toBeVisible();
 expect((await(await context.request.get('https://127.0.0.1:9443/__test/count')).json()).renewalCompletes).toBe(before.renewalCompletes);await authorize.click();await expect(page.getByText('Agent access authorized for the existing request.')).toBeVisible();
 expect((await(await context.request.get('https://127.0.0.1:9443/__test/count')).json()).renewalCompletes).toBe(before.renewalCompletes+1);
});
test('revocation after review reaches explicit recovery through the real resolve bridge',async({page,context})=>{
 await login(context);await page.goto('/agent/handoff/'+'l'.repeat(43));await page.getByRole('button',{name:'Continue securely'}).click();await expect(page.getByRole('button',{name:'Review agent access'})).toBeVisible();await expect(page.getByRole('link',{name:'Open Stripe securely'})).toHaveCount(0);
});
test('actual hosted OAuth start/callback and customer quote consent work behind the public HTTPS proxy',async({page,context})=>{
 await page.goto('/agent/consent/'+quoteId);await page.getByRole('link',{name:'Sign in to review'}).click();await expect(page.getByRole('button',{name:'Authorize rental request'})).toBeVisible();
 await expect(page.getByText('Synthetic cancellation policy')).toBeVisible();const sessionCookie=(await context.cookies()).find(c=>c.name==='__Host-exotiq-customer');expect(sessionCookie?.httpOnly).toBe(true);expect(sessionCookie?.secure).toBe(true);expect(await page.evaluate(()=>document.cookie)).not.toContain('__Host-exotiq-customer');
 await expect(page.getByRole('button',{name:'Authorize rental request'})).toBeDisabled();await expect(page.getByLabel('Open customer-hosted identity verification for this rental')).not.toBeChecked();
 await page.getByLabel('Read this rental request’s status').check();await page.getByLabel('Open customer-hosted checkout for this rental').check();
 await page.getByRole('button',{name:'Authorize rental request'}).click();await expect(page.getByText('Authorization recorded.',{exact:false})).toBeVisible();
 const leaked=await page.evaluate(async()=>{const r=await fetch('/api/agent/auth/session?access_token=ignored');return {status:r.status,body:await r.text()};});expect(leaked.status).toBe(401);expect(leaked.body).not.toContain('csrf');
 const polluted=await page.evaluate(async()=>{const r=await fetch('/api/agent/customer/quotes/'+document.location.pathname.split('/').pop()+'?customer_id=other');return r.status;});expect(polluted).toBe(503);
});
test('fixed provider return survives real hosted login without trusting a payment success claim',async({page})=>{
 const path='/agent/account/10000000-0000-4000-8000-000000000002?booking_ref=SYNTHETIC-REQUEST&action=checkout';
 await page.goto(path);await page.getByRole('link',{name:'Sign in to review your rental request'}).click();
 await expect(page.getByText('Rental reference: SYNTHETIC-REQUEST')).toBeVisible();expect(new URL(page.url()).pathname+new URL(page.url()).search).toBe(path);
 await expect(page.getByText('Payment settlement is still pending.')).toBeVisible();await expect(page.getByText('Current status: pending_payment')).toBeVisible();
 await expect(page.getByText('Returning here does not confirm payment or identity verification.',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Link my customer account'})).toHaveCount(0);
 await page.goto(path+'&unexpected=field');await expect(page.getByRole('heading',{name:'Invalid provider return'})).toBeVisible();await expect(page.getByText('Rental reference:',{exact:false})).toHaveCount(0);
});
test('actual customer status bridge hides wrong-customer data and returned provider metadata',async({page,context})=>{
 await login(context,'other-customer');await page.goto('/agent/account/10000000-0000-4000-8000-000000000002?booking_ref=SYNTHETIC-REQUEST&action=identity');
 await expect(page.getByRole('main').getByRole('alert')).toContainText('current rental status could not be confirmed');await expect(page.getByText('Synthetic touring car')).toHaveCount(0);
 const denied=await page.evaluate(async()=>{const r=await fetch('/api/agent/customer/customers/rental-requests/SYNTHETIC-REQUEST');return {status:r.status,body:await r.text()};});expect(denied.status).toBe(404);expect(denied.body).not.toContain('private other customer');expect(denied.body).not.toContain('provider_url');
});
