import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import islandDev from '../node_modules/astro/dist/runtime/server/astro-island.prebuilt-dev.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:4338',output=process.env.TEST_OUTPUT||'/private/tmp/ielts-notebook-check';
mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:960},acceptDownloads:true}),page=await context.newPage();page.setDefaultTimeout(15000);
const errors=[],posts=[],external=[],checks=[];const key='ielts-notebook-v1:demo';
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});page.on('dialog',d=>d.accept());
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS',name);};
const content=JSON.parse(readFileSync('src/lib/ielts/mock/c16-test1-content.json','utf8'));
// Only review GET and identity are fixtures; real local SSR denies anonymous access.
await page.route('**/api/ielts/review?*',async route=>{
 const n=Number(new URL(route.request().url()).searchParams.get('question')),subject=new URL(route.request().url()).searchParams.get('subject');
 const pair=content.questions[subject].flat().find(b=>b.type==='pair'&&b.numbers.includes(n)),numbers=pair?.numbers||[n],i=content.sections[subject].findIndex(s=>n>=s.first&&n<=s.last);
 await route.fulfill({contentType:'application/json',body:JSON.stringify({section:content.sections[subject][i],blocks:content.questions[subject][i],numbers,expected:numbers.map(v=>content.answerKeys[subject][v-1])})});
});
try{
 await check('real anonymous SSR and review endpoint reject access',async()=>{
  for(const path of ['/ielts/mistakes','/ielts/wordbook','/ielts/mistakes?demo=0']){const r=await context.request.get(origin+path,{maxRedirects:0});assert.equal(r.status(),302);assert.match(r.headers()['cache-control'],/no-store/);}
  const r=await context.request.get(origin+'/api/ielts/review?book=16&test=1&subject=reading&question=1');assert.equal(r.status(),401);assert.match(r.headers()['cache-control'],/no-store/);
 });
 await check('real reading exam submission automatically archives all incorrect question groups locally',async()=>{
  await page.goto(origin+'/ielts/mock/c16-test-1?subject=reading&demo=1',{waitUntil:'domcontentloaded'});await page.locator('[data-ready]').check();await page.locator('[data-start-button]').click();
  await page.locator('[data-submit]').click();await page.locator('[data-dialog]').waitFor();
  assert.match(await page.locator('[data-notebook-status]').textContent(),/已收录/);
  const book=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert.equal(book.mistakes.flatMap(v=>v.numbers).length,40);assert.ok(book.mistakes.every(v=>v.reason==='漏答'));
 });
 await check('mistake page retains notes and reason after reload, and renders original question for redo',async()=>{
  await page.goto(origin+'/ielts/mistakes?demo=1',{waitUntil:'domcontentloaded'});await page.locator('[data-entry]').first().waitFor();
  await page.locator('[data-entry] select').first().selectOption('定位');await page.locator('[data-entry] textarea').first().fill('定位句 <img src=x onerror=alert(1)>');await page.locator('[data-entry] textarea').first().blur();
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-entry]').first().waitFor();assert.equal(await page.locator('[data-entry] select').first().inputValue(),'定位');assert.match(await page.locator('[data-entry] textarea').first().inputValue(),/定位句/);assert.equal(await page.locator('[data-list] img').count(),0);
  await page.locator('[data-entry]').first().getByRole('button',{name:'重做',exact:true}).click();await page.locator('[data-review-form]').waitFor();assert.ok(await page.locator('[data-context] img').count()>0);
  for(const input of await page.locator('[data-review-inputs] input').all()){const n=Number(await input.getAttribute('name'));await input.fill(content.answerKeys.reading[n-1].split('|')[0]);}
  await page.locator('[data-review-form] button').click();assert.equal(await page.locator('[data-feedback]').textContent(),'正确。');assert.equal(await page.locator('[data-review-form] button').isDisabled(),true);
  const book=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert.equal(book.mistakes[0].streak,1);assert.ok(book.mistakes[0].due>Date.now());await page.locator('[data-close-review]').click();
 });
 await check('search, due/group filters and JSON export operate without uploads',async()=>{
  await page.locator('[data-group]').selectOption('定位');assert.equal(await page.locator('[data-entry]').count(),1);await page.locator('[data-state]').selectOption('due');assert.equal(await page.locator('[data-entry]').count(),0);
  await page.locator('[data-state]').selectOption('all');await page.locator('[data-group]').selectOption('all');await page.locator('[data-search]').fill('定位句');assert.equal(await page.locator('[data-entry]').count(),1);await page.locator('[data-search]').fill('');
  const download=page.waitForEvent('download');await page.locator('[data-export]').click();const d=await download;assert.equal(d.suggestedFilename(),'IELTS-错题本.json');await d.saveAs(output+'/mistakes.json');const v=JSON.parse(readFileSync(output+'/mistakes.json','utf8'));assert.ok(v.mistakes.length>0);assert.equal(v.accountId,undefined);
 });
 await check('manual word creation, edit and case-insensitive duplicate merge preserve data and reject HTML execution',async()=>{
  await page.goto(origin+'/ielts/wordbook?demo=1',{waitUntil:'domcontentloaded'});await page.locator('summary').click();
  const form=page.locator('[data-word-form]');await form.locator('[name=word]').fill('Notebook');await form.locator('[name=meaning]').fill('<img src=x onerror=alert(1)>');await form.locator('[name=group]').fill('自定义');await form.locator('[name=example]').fill('A private example.');await form.locator('button').click();await page.locator('[data-entry]').first().waitFor();
  assert.equal(await page.locator('[data-entry] img').count(),0);assert.match(await page.locator('[data-entry]').first().textContent(),/<img/);
  await page.locator('[data-entry]').first().getByRole('button',{name:'编辑',exact:true}).click();await form.locator('[name=word]').fill('notebook');await form.locator('[name=meaning]').fill('笔记本');await form.locator('button').click();assert.equal(await page.locator('[data-entry]').count(),1);assert.match(await page.locator('[data-entry]').textContent(),/笔记本/);
 });
 await check('existing vocabulary collection and local pronunciation are functional',async()=>{
  const data=await page.locator('#notebook-payload').evaluate(el=>JSON.parse(el.textContent)),word=data.words.find(w=>w.answer==='deck'),book=data.books.find(b=>b.items.includes(word.id));
  await page.locator('[data-catalog-book]').selectOption(book.id);await page.locator('[data-catalog-search]').fill('deck');await page.locator('[data-catalog-list]').getByRole('button',{name:'＋ deck',exact:true}).click();
  const entry=page.locator('[data-entry]').filter({has:page.getByRole('heading',{name:'deck',exact:true})});await entry.getByRole('button',{name:'发音',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-context] audio')?.readyState>=2);assert.equal(await page.locator('[data-context] audio').evaluate(a=>new URL(a.src).origin),origin);await page.locator('[data-close-review]').click();
 });
 await check('word review updates spaced repetition once, with remembered/needs-review branches',async()=>{
  const entry=page.locator('[data-entry]').filter({has:page.getByRole('heading',{name:'notebook',exact:true})});await entry.getByRole('button',{name:'复习',exact:true}).click();await page.getByRole('button',{name:'显示释义',exact:true}).click();await page.locator('[data-rating=correct]').click();assert.match(await page.locator('[data-feedback]').textContent(),/已更新/);await page.locator('[data-close-review]').click();
  await entry.getByRole('button',{name:'复习',exact:true}).click();await page.getByRole('button',{name:'显示释义',exact:true}).click();await page.locator('[data-rating=wrong]').click();await page.locator('[data-close-review]').click();const v=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert.equal(v.words.find(w=>w.word==='notebook').streak,0);
 });
 await check('storage failure reports failure without overwriting the existing wordbook',async()=>{
  const before=await page.evaluate(k=>localStorage.getItem(k),key);await page.evaluate(()=>{window.realStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('quota');};});
  await page.locator('[name=word]').fill('quota-test');await page.locator('[data-word-form] button').click();assert.match(await page.locator('[data-status]').textContent(),/不可用或已满/);assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),before);await page.evaluate(()=>Storage.prototype.setItem=window.realStorageSet);
 });
 await check('dictation collection uses verified account identity and preserves its real audio reference',async()=>{
  await page.route('**/api/ielts/auth/me',r=>r.fulfill({contentType:'application/json',body:'{"authenticated":true,"userId":"11111111-1111-4111-8111-111111111111"}'}));
  await page.goto(origin+'/ielts/dictation?book=easy&word=mature',{waitUntil:'domcontentloaded'});await page.locator('[data-start]').click();await page.locator('[data-save-word]').click();await page.waitForFunction(()=>document.querySelector('[data-word-save-status]').textContent.includes('已收藏'));
  const collected=await page.evaluate(()=>JSON.parse(localStorage.getItem('ielts-notebook-v1:11111111-1111-4111-8111-111111111111')));assert.equal(collected.words.length,1);assert.ok(collected.words[0].audioId);assert.equal(collected.words[0].source,'单词听写');
 });
 await check('accounts remain isolated; pagehide clears notes, custom groups, review text and visible counts',async()=>{
  await page.goto(origin+'/ielts/wordbook?demo=1',{waitUntil:'domcontentloaded'});await page.locator('[data-entry]').first().waitFor();assert.equal(await page.locator('[data-entry]').count(),2);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));assert.equal(await page.locator('[data-entry]').count(),0);assert.equal(await page.locator('[data-group] option').count(),1);for(const selector of ['[data-count]','[data-review-title]','[data-feedback]'])assert.equal(await page.locator(selector).textContent(),'');
 });
 await check('cross-tab signout wipes private UI and redirects; mobile/dark layouts do not overflow',async()=>{
  await page.goto(origin+'/ielts/wordbook?demo=1',{waitUntil:'domcontentloaded'});await page.locator('[data-entry]').first().waitFor();await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/wordbook-mobile.png',fullPage:true});await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({path:output+'/wordbook-dark.png',fullPage:true});
  await page.evaluate(()=>{const c=new BroadcastChannel('ielts-auth-events');c.postMessage({type:'logout'});setTimeout(()=>c.close(),100);});await page.waitForURL(url=>url.pathname==='/ielts');assert.equal(await page.locator('[data-notebook]').count(),0);
 });
 await check('production CSP permits notebook initialization and blocks injected inline scripts',async()=>{
  const strict=await browser.newContext({viewport:{width:1440,height:960}}),secure=await strict.newPage();const policy=JSON.parse(readFileSync('vercel.json','utf8')).headers.find(h=>h.source==='/ielts(.*)').headers.find(h=>h.key==='Content-Security-Policy').value.replace('; upgrade-insecure-requests','');
  await secure.route('**/*',async route=>{
   if(!route.request().isNavigationRequest())return route.continue();const response=await route.fetch(),body=await response.text();
   const inline=[...body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(m=>!m[1].includes('application/json')&&!m[1].includes('src=')).map(m=>m[2]);const hashes=[islandDev,...inline].map(s=>`'sha256-${createHash('sha256').update(s).digest('base64')}'`).join(' ');
   await route.fulfill({response,body,headers:{...response.headers(),'content-security-policy':policy.replace("script-src 'self'",`script-src 'self' ${hashes}`)}});
  });
  for(const path of ['mistakes','wordbook']){await secure.goto(origin+`/ielts/${path}?demo=1`,{waitUntil:'domcontentloaded'});await secure.waitForFunction(()=>document.querySelector('[data-list]').textContent.length>0);await secure.evaluate(()=>{const s=document.createElement('script');s.textContent='window.notebookInjection=true';document.body.append(s);});assert.equal(await secure.evaluate(()=>window.notebookInjection),undefined);}
  await strict.close();
 });
 assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);assert.deepEqual(external,[]);writeFileSync(output+'/result.json',JSON.stringify({checks,errors,posts,external},null,2));console.log(`${checks.length} flows passed; zero browser errors or answer uploads.`);
}finally{await browser.close();}
