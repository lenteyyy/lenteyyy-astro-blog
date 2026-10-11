import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {extname} from 'node:path';
import islandDev from '../node_modules/astro/dist/runtime/server/astro-island.prebuilt-dev.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:4336';
const output=process.env.TEST_OUTPUT||'/private/tmp/cambridge16-17-browser';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:960}});const page=await context.newPage();
page.setDefaultTimeout(10000);
const errors=[],external=[],posts=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:'))external.push(r.url());if(r.method()==='POST')posts.push(r.url());});
page.on('dialog',d=>d.accept());
const start=async()=>{await page.locator('[data-ready]').check();await page.locator('[data-start-button]').click();};
const highlight=async region=>{
 await page.evaluate(async name=>{const span=[...document.querySelectorAll(`[data-highlight-region="${name}"] .scan-text-line`)].find(el=>el.textContent.length>20);span.scrollIntoView({block:'center'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},region);
 await page.evaluate(name=>{
  const lines=[...document.querySelectorAll(`[data-highlight-region="${name}"] .scan-text-line`)];
  const span=lines.find(el=>el.textContent.length>20);if(!span)throw Error('Missing selectable source text');
  const range=document.createRange();range.setStart(span.firstChild,2);range.setEnd(span.firstChild,Math.min(18,span.firstChild.length));
  const s=getSelection();s.removeAllRanges();s.addRange(range);
 },region);
 await page.locator('[data-highlight-add="yellow"]').click();
 const marked=page.locator(`[data-highlight-region="${region}"] mark[data-reading-highlight]`);assert.equal(await marked.count(),1);
 await marked.evaluate(mark=>{const range=document.createRange();range.setStart(mark.firstChild,0);range.setEnd(mark.firstChild,mark.firstChild.length);const s=getSelection();s.removeAllRanges();s.addRange(range);});
 await page.locator('[data-highlight-add="blue"]').click();assert.equal(await marked.getAttribute('data-color'),'blue');
};
try{
 if(process.env.TEST_PHASE!=='boundaries'){
 for(const book of [16,17])for(let t=1;t<=4;t++)for(const subject of ['listening','reading','writing']){
  console.log('CHECK',book,t,subject);
  await page.goto(`${origin}/ielts/mock/c${book}-test-${t}?subject=${subject}&demo=1`,{waitUntil:'domcontentloaded'});await start();
  const payload=await page.locator('#exam-payload').evaluate(el=>JSON.parse(el.textContent));assert.equal(payload.bookNumber,book);
  if(subject==='listening'){
   await page.waitForFunction(()=>{const a=document.querySelector('[data-audio]');return a.readyState>=2&&!a.paused;});
   assert.equal(await page.locator('[data-audio]').evaluate(a=>a.controls),false);await page.locator('[data-audio-rate]').selectOption('0.9');assert.equal(await page.locator('[data-audio]').evaluate(a=>a.playbackRate),.9);
   await page.locator('[data-audio]').evaluate(a=>a.pause());await page.waitForFunction(()=>!document.querySelector('[data-audio]').paused);
   assert.ok(await page.locator('[data-submit]').isDisabled());
  }
  for(let i=0;i<payload.sections.length;i++){
   await page.locator('[data-section-tabs] button').nth(i).press('Enter');
   await page.locator('.scan-page img').evaluateAll(async images=>{for(const image of images){image.loading='eager';await image.decode();}});
   await page.waitForFunction(()=>[...document.querySelectorAll('.scan-page img')].every(i=>i.complete&&i.naturalWidth>0));
   for(const region of subject==='reading'?['passage','questions']:subject==='writing'?['passage']:['questions'])await highlight(region);
   if(subject==='writing')await page.locator('textarea.essay').fill(`local-only-${book}-${t}-${i} <script>globalThis.compromised=1</script>`);
   else{
    const controls=page.locator('.inline-answer input, .inline-answer select');
    for(let j=0;j<await controls.count();j++){
     const el=controls.nth(j);if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption({index:1});else await el.fill('local-only-test');
    }
    for(const pair of await page.locator('.choice-question').all()) {const boxes=pair.locator('input[type=checkbox]');if(await boxes.count()){await boxes.nth(0).check();await boxes.nth(1).check();}}
   }
   assert.equal(await page.evaluate(()=>globalThis.compromised),undefined);
  }
  const before=await page.evaluate(()=>JSON.stringify({...localStorage}));assert.ok(before.includes('blue'));assert.ok(before.includes('local-only'));
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-resume]').click();
  assert.ok(await page.locator('mark[data-reading-highlight]').count()>0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(t===1)await page.screenshot({path:`${output}/c${book}-${subject}.png`,fullPage:true});
  checks.push(`C${book} T${t} ${subject}: all sections, inputs, annotation, save/reload and local-only answers`);console.log('PASS',checks.at(-1));
 }
 assert.equal(external.length,0,external.join('\n'));assert.equal(posts.length,0,'No exam answers sent over the network');assert.deepEqual(errors,[]);
 const cueFixtures=JSON.parse(readFileSync('tests/fixtures/listening-cues.json','utf8'));
 for(const book of [16,17])for(let t=1;t<=4;t++){
  const sim=await context.newPage();sim.setDefaultTimeout(10000);await sim.clock.install({time:new Date()});
  await sim.goto(`${origin}/ielts/mock/c${book}-test-${t}?subject=listening&mode=simulation&subjects=listening,reading,writing&demo=1`,{waitUntil:'domcontentloaded'});
  await sim.locator('[data-ready]').check();await sim.locator('[data-start-button]').click();
  await sim.evaluate(({book,t,cue})=>{const key=`lenteyyy-mock-c${book}-t${t}-listening-demo-simulation-listening-reading-writing`;const s=JSON.parse(localStorage.getItem(key));s.playback={part:3,time:cue,rate:1,complete:false};localStorage.setItem(key,JSON.stringify(s));},{book,t,cue:cueFixtures[`${book}-${t}`].seconds});
  await sim.reload({waitUntil:'domcontentloaded'});await sim.locator('[data-resume]').click();assert.equal(await sim.locator('[data-clock]').textContent(),'02:00');
  await sim.clock.fastForward(121000);await sim.waitForURL(url=>url.searchParams.get('subject')==='reading');await sim.waitForLoadState('domcontentloaded');assert.equal(await sim.locator('[data-start]').count(),0);
  await sim.clock.fastForward(3601000);await sim.waitForURL(url=>url.searchParams.get('subject')==='writing');await sim.waitForLoadState('domcontentloaded');await sim.locator('textarea.essay').fill('This is a local simulated exam answer.');
  await sim.clock.fastForward(3601000);assert.ok(await sim.locator('[data-dialog]').isVisible());assert.match(await sim.locator('[data-dialog-body]').textContent(),/模考已完成/);
  checks.push(`C${book} T${t} simulation: exact 2-minute check, then reading/writing auto-advance and final submit`);console.log('PASS',checks.at(-1));await sim.close();
 }
 writeFileSync(output+'/exam-result.json',JSON.stringify({checks,errors,external,posts},null,2));
 }
 const anon=await context.newPage();
 const me=await context.request.get(origin+'/api/ielts/auth/me');assert.equal(me.status(),200);assert.deepEqual(await me.json(),{authenticated:false});
 for(const path of ['/api/ielts/bookings','/api/ielts/materials'])assert.equal((await context.request.get(origin+path)).status(),401);
 for(const path of ['/ielts/management','/ielts/mock/c17-test-4?subject=reading']){await anon.goto(origin+path);assert.ok(new URL(anon.url()).pathname==='/ielts');assert.ok(!(await anon.locator('[data-exam]').count()));}
 for(const path of ['/api/ielts/auth/login','/api/ielts/auth/request-code','/api/ielts/auth/verify-code','/api/ielts/auth/logout','/api/ielts/bookings','/api/ielts/materials','/api/ielts/materials/upload-url']){
  const r=await context.request.post(origin+path,{headers:{origin:'https://attacker.test'},data:{}});assert.equal(r.status(),403);
 }
 checks.push('real local API/page boundaries: anonymous private access and cross-origin writes rejected');
 const policy=JSON.parse(readFileSync('vercel.json','utf8')).headers.find(h=>h.source==='/ielts(.*)').headers.find(h=>h.key==='Content-Security-Policy').value.replace('; upgrade-insecure-requests','');
 const strict=await browser.newContext({viewport:{width:1440,height:960}});const secure=await strict.newPage();const policyErrors=[];secure.on('pageerror',e=>policyErrors.push(e.message));
 await secure.route('**/*',async route=>{
  const url=new URL(route.request().url());const pathname=url.pathname;
  const html=`dist/client${pathname}/index.html`;
  const asset=`dist/client${pathname}`;
  if(url.origin===origin&&route.request().isNavigationRequest()&&existsSync(html)){
   await route.fulfill({body:readFileSync(html),contentType:'text/html',headers:{'content-security-policy':policy}});
  }else if(url.origin===origin&&!route.request().isNavigationRequest()&&existsSync(asset)&&extname(asset)){
   const types={'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
   await route.fulfill({body:readFileSync(asset),contentType:types[extname(asset)]||'application/octet-stream'});
  }else if(route.request().isNavigationRequest()){
   // SSR mocks are tested on the local dev server. Authorize only the known dev
   // island runtime and toolbar; the production static pages above use exact
   // production hashes with no dev exceptions.
   const r=await route.fetch();const body=await r.text();
   const toolbar=[...body.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.startsWith('window.__astro_dev_toolbar__ = '));
   const hashes=[islandDev,...(toolbar?[toolbar]:[])].map(s=>`'sha256-${createHash('sha256').update(s).digest('base64')}'`).join(' ');
   const localPolicy=policy.replace("script-src 'self'",`script-src 'self' ${hashes}`);
   await route.fulfill({response:r,body,headers:{...r.headers(),'content-security-policy':localPolicy}});
  }else await route.continue();
 });
 for(const path of ['/ielts','/ielts/mock/c16-test-1?subject=reading&demo=1','/ielts/dictation','/ielts/typing','/ielts/score-calculator']){
  await secure.goto(origin+path,{waitUntil:'domcontentloaded'});
  if(path==='/ielts'){await secure.waitForFunction(()=>document.querySelector('astro-island')&&!document.querySelector('astro-island').hasAttribute('ssr'));}
  if(path.includes('/mock/')){await secure.locator('[data-ready]').check();await secure.locator('[data-start-button]').click();assert.ok(await secure.locator('.scan-page').count()>0);}
  await secure.evaluate(()=>{const script=document.createElement('script');script.textContent='globalThis.inlineAttackExecuted=true';document.body.append(script);});assert.equal(await secure.evaluate(()=>globalThis.inlineAttackExecuted),undefined);
 }
 assert.deepEqual(policyErrors,[]);checks.push('strict IELTS CSP: all tools initialize; injected inline JavaScript is blocked');await strict.close();
 // A fresh context isolates mobile layout from the simulated multi-hour clock
 // and completed local exam states used by the preceding simulation checks.
 const mobileContext=await browser.newContext({viewport:{width:390,height:844}});const mobile=await mobileContext.newPage();
 await mobile.goto(`${origin}/ielts/mock/c17-test-4?subject=reading&demo=1`,{waitUntil:'domcontentloaded'});await mobile.locator('[data-ready]').check();await mobile.locator('[data-start-button]').click();await mobile.locator('.scan-page img').evaluateAll(async images=>{for(const image of images){image.loading='eager';await image.decode();}});assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mobile.screenshot({path:output+'/mobile-reading.png',fullPage:true});checks.push('mobile source pages and answer sheet do not overflow');await mobileContext.close();
 writeFileSync(output+'/result.json',JSON.stringify({checks,errors,external,posts},null,2));console.log('ALL PASS',checks.length);
}catch(error){await page.screenshot({path:output+'/failure.png',fullPage:true});console.error('PAGE ERRORS',errors);throw error;}finally{await browser.close();}
