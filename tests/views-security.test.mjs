import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadViews(overrides = {}) {
 const source=readFileSync(new URL('../src/pages/api/views/[slug].ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('import.meta.env.PROD','true');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(code,{exports,Response,URL,getPostBySlug:async()=>({slug:'known'}),redis:async()=>({result:'12'}),withinRateLimit:async()=>true,recordDailyView:async()=>({result:'13'}),...overrides});
 return exports;
}

test('unknown or unpublished articles cannot create Redis view or deduplication keys',async()=>{
 const source=readFileSync(new URL('../src/pages/api/views/[slug].ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('import.meta.env.PROD','true');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 let calls=0;const exports={},upstream=async()=>{calls++;throw Error('unexpected Redis access');};
 vm.runInNewContext(code,{exports,Response,URL,getPostBySlug:async()=>undefined,redis:upstream,withinRateLimit:upstream,recordDailyView:upstream});
 const request=new Request('https://www.lenteyyy.com/api/views/attacker-key?increment=1',{headers:{referer:'https://www.lenteyyy.com/posts/attacker-key'}});
 const response=await exports.GET({params:{slug:'attacker-key'},request});assert.equal(response.status,404);assert.deepEqual(await response.json(),{error:'not_found'});assert.equal(calls,0);
});

test('bots, speculative loads, unrelated referrers and already-counted visitors cannot increment',async()=>{
 const url='https://www.lenteyyy.com/api/views/known';
 for(const extra of [{'user-agent':'ExampleBot'},{purpose:'prefetch'},{'sec-purpose':'prerender'},{referer:'https://www.lenteyyy.com/about'},{referer:'https://example.test/posts/known'}]){
  const commands=[];const route=loadViews({redis:async command=>{commands.push(command);return {result:12};},recordDailyView:async()=>assert.fail('Invalid page visit claimed a view')});
  const request=new Request(url,{method:'POST',headers:{origin:'https://www.lenteyyy.com',referer:'https://www.lenteyyy.com/posts/known',...extra}});
  assert.equal((await route.POST({params:{slug:'known'},request})).status,200);
  assert.deepEqual(JSON.parse(JSON.stringify(commands)),[['GET','post:views:known']]);
 }
 let visits=0;const route=loadViews({redis:async()=>assert.fail('Atomic view unexpectedly used standalone Redis'),recordDailyView:async()=>{visits++;return {result:12};}});
 const request=new Request(url,{method:'POST',headers:{origin:'https://www.lenteyyy.com',referer:'https://www.lenteyyy.com/zh-tw/posts/known'}});
 assert.equal((await route.POST({params:{slug:'known'},request})).status,200);assert.equal(visits,1);
});

test('API error responses do not expose backend errors, and invalid slugs never reach Redis',async()=>{
 const denied=async()=>assert.fail('Invalid slug reached a backend');const route=loadViews({getPostBySlug:denied,redis:denied,withinRateLimit:denied});
 for(const slug of ['../private','known/other','known?test','a'.repeat(121),''])assert.equal((await route.GET({params:{slug},request:new Request('https://www.lenteyyy.com/api/views/known')})).status,400);
 const broken=loadViews({redis:async()=>{throw Error('backend_private_error');}});
 const response=await broken.GET({params:{slug:'known'},request:new Request('https://www.lenteyyy.com/api/views/known')});
 assert.doesNotMatch(await response.text(),/backend_private_error/);assert.equal(response.headers.get('cache-control'),'private, no-store');
});

test('GET and prefetch requests cannot increment article counters',async()=>{
 const commands=[];
 const route=loadViews({redis:async command=>{commands.push(command);return {result:'12'};},recordDailyView:async()=>assert.fail('GET claimed a daily view')});
 const request=new Request('https://www.lenteyyy.com/api/views/known?increment=1',{headers:{referer:'https://www.lenteyyy.com/posts/known'}});
 const response=await route.GET({params:{slug:'known'},request});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{slug:'known',views:12});assert.deepEqual(JSON.parse(JSON.stringify(commands)),[['GET','post:views:known']]);
});

test('cross-site and missing-origin POST requests are rejected before any upstream access',async()=>{
 const denied=async()=>assert.fail('Cross-site request reached data service');
 const route=loadViews({getPostBySlug:denied,redis:denied,withinRateLimit:denied,recordDailyView:denied});
 for(const headers of [{origin:'https://lenteyielts.cn'},{origin:'https://www.lenteyyy.com','sec-fetch-site':'cross-site'},{}]){
  const response=await route.POST({params:{slug:'known'},request:new Request('https://www.lenteyyy.com/api/views/known',{method:'POST',headers})});
  assert.equal(response.status,403);assert.equal(response.headers.get('cross-origin-resource-policy'),'same-origin');
 }
});

test('only same-origin article visits increment; rate limits and invalid counters fail safely',async()=>{
 const commands=[];const url='https://www.lenteyyy.com/api/views/known';
 const request=new Request(url,{method:'POST',headers:{origin:'https://www.lenteyyy.com',referer:'https://www.lenteyyy.com/posts/known','sec-fetch-site':'same-origin'}});
 const route=loadViews({redis:async()=>assert.fail('Increment bypassed atomic view operation'),recordDailyView:async(_request,slug)=>{commands.push(slug);return {result:13};}});
 assert.equal((await route.POST({params:{slug:'known'},request})).status,200);assert.deepEqual(commands,['known']);
 const limited=loadViews({withinRateLimit:async()=>false,redis:async()=>assert.fail('Rate-limited request reached Redis')});
 const rejected=await limited.POST({params:{slug:'known'},request});assert.equal(rejected.status,429);assert.equal(rejected.headers.get('retry-after'),'60');
 for(const value of [{},'garbage',-1,Infinity,'9007199254740993']){
  const broken=loadViews({redis:async()=>({result:value})});const response=await broken.GET({params:{slug:'known'},request:new Request(url)});
  assert.equal((await response.json()).unavailable,true);assert.equal(response.headers.get('cache-control'),'private, no-store');
 }
 const broken=loadViews({recordDailyView:async()=>{throw Error('private_backend_details');}});
 const response=await broken.POST({params:{slug:'known'},request});
 assert.equal((await response.json()).unavailable,true);
});
