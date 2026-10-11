import assert from 'node:assert/strict';
import{mkdirSync,writeFileSync}from'node:fs';
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:4337';
const output='/private/tmp/ielts-session-privacy-check';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const checks=[],errors=[];
const fixture=async()=>{
 const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 let identity='A',delayed=0;const pending=[];
 const response=(route,body)=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 await context.route('**/api/ielts/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/auth/me'))return response(route,identity?{authenticated:true,userId:identity,email:'same@example.test',role:'student'}:{authenticated:false});
  if(path.endsWith('/auth/logout')){identity='';return response(route,{ok:true});}
  if(path.endsWith('/availability'))return response(route,{unavailable:[]});
  if(path.endsWith('/materials')||path.endsWith('/bookings')){
   const account=identity;
   const body=path.endsWith('/materials')?{materials:[{id:'id-'+account,title:'PRIVATE-'+account,category:'阅读',size_bytes:1024}]}:{bookings:[{id:'id-'+account,lesson_date:'PRIVATE-'+account,lesson_time:'10:30',lesson_subject:'阅读',status:'cancelled'}]};
   if(account==='A'){
    delayed++;await new Promise(resolve=>pending.push(resolve));
    try{return await response(route,body);}catch{return;}
   }
   return response(route,body);
  }
  throw Error('Unexpected API request '+path);
 });
 await page.goto(origin+'/ielts',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('[data-account-button]').title==='same@example.test');
 while(delayed<2)await new Promise(r=>setTimeout(r,10));
 return{context,page,setIdentity:value=>{identity=value;},release:()=>pending.splice(0).forEach(fn=>fn())};
};
try{
 const logout=await fixture();await logout.page.locator('[data-account-button]').click();await logout.page.locator('[data-account-logout]').click();logout.release();
 await logout.page.waitForFunction(()=>document.querySelector('[data-account-email]').textContent==='尚未登录');
 assert.doesNotMatch(await logout.page.locator('body').textContent(),/PRIVATE-A/);assert.equal(await logout.page.locator('[data-management-link]').isVisible(),false);
 checks.push('Logout clears private DOM before delayed A responses settle');await logout.context.close();
 const change=await fixture();change.setIdentity('B');const other=await change.context.newPage();await other.goto(origin+'/ielts/privacy');
 await other.evaluate(()=>{const channel=new BroadcastChannel('ielts-auth-events');channel.postMessage('changed');setTimeout(()=>channel.close(),50);});
 await change.page.waitForFunction(()=>document.querySelector('[data-material-list]').textContent.includes('PRIVATE-B'));change.release();
 assert.doesNotMatch(await change.page.locator('body').textContent(),/PRIVATE-A/);assert.match(await change.page.locator('[data-booking-list]').textContent(),/PRIVATE-B/);
 checks.push('Cross-tab switch with the same email cannot show the old user ID data');
 await change.page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
 assert.equal(await change.page.locator('[data-material-list]').textContent(),'');assert.equal(await change.page.locator('[data-booking-list]').textContent(),'');
 await change.page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 await change.page.waitForFunction(()=>document.querySelector('[data-material-list]').textContent.includes('PRIVATE-B'));
 checks.push('BFCache lifecycle clears private data and revalidates before restoring it');await change.context.close();
 const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/api/ielts/auth/me',route=>route.fulfill({contentType:'application/json',body:'{"authenticated":false}'}));
 await context.route('**/api/ielts/availability?*',route=>route.fulfill({contentType:'application/json',body:'{"unavailable":[]}'}));
 await page.goto(origin+'/ielts');await page.locator('[data-account-button]').click();await page.locator('[data-account-login]').click();
 await page.locator('[data-login-form] input[name=password]').fill('synthetic-password1');
 await page.locator('[data-login-form] [data-close-auth]').click();await page.locator('[data-auth-dialog]').waitFor({state:'hidden'});
 assert.equal(await page.locator('[data-login-form] input[name=password]').inputValue(),'');checks.push('Closing login removes password/code values');await context.close();
 assert.deepEqual(errors,[]);writeFileSync(output+'/result.json',JSON.stringify({checks,errors},null,2));console.log('PASS',checks.join('; '));
}finally{await browser.close();}
