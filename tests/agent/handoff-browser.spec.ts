import {test,expect,type BrowserContext} from '@playwright/test';
const nonce='a'.repeat(43),origin='https://rent.synthetic.invalid:9444';
async function login(context:BrowserContext,subject='renter'){const response=await context.request.get('https://127.0.0.1:9443/__test/session?subject='+subject);expect(response.ok()).toBe(true);const {cookie}=await response.json();await context.addCookies([{name:'__Host-exotiq-customer',value:cookie,url:origin,httpOnly:true,secure:true,sameSite:'Lax'}]);}
test.beforeEach(async({context})=>{await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin===origin)return route.continue();return route.abort('blockedbyclient');});});
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
