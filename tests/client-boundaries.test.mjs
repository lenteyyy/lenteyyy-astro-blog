import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, scope = {}) {
 const source = fs.readFileSync(file, 'utf8').replace(/^import .*;\n/gm, '');
 const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports = {};vm.runInNewContext(code,{exports,...scope});return exports;
}

test('locale navigation rejects protocol-relative, executable and backslash destinations',()=>{
 const {localizedPath}=load('src/lib/locale.ts',{OpenCC:{Converter:()=>x=>x}});
 for(const value of ['//evil.test','/\\evil.test','https://evil.test','javascript:alert(1)','/\tevil.test']){
  for(const locale of ['zh-CN','zh-TW'])assert.equal(new URL(localizedPath(value,locale),'https://www.lenteyyy.com').origin,'https://www.lenteyyy.com');
 }
 assert.equal(localizedPath('/posts/known','zh-TW'),'/zh-tw/posts/known');
 assert.equal(localizedPath('/','zh-TW'),'/zh-tw');
});

test('view counter browser deduplication expires each UTC day instead of lasting for the entire tab session',async()=>{
 const today=new Date().toISOString().slice(0,10);
 const source=fs.readFileSync('src/components/ViewCounter.astro','utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^\s*import .*;\n/gm,'');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const [stored,method]of [[today,'GET'],['2000-01-01','POST'],['1','POST'],[null,'POST']]){
  let request,saved;const item={dataset:{slug:'known',label:'阅读量'},textContent:''};
  vm.runInNewContext(code,{Date,navigator:{userAgent:'audit browser'},encodeURIComponent,
   document:{visibilityState:'visible',querySelectorAll:()=>[item]},
   sessionStorage:{getItem:()=>stored,setItem:(_key,value)=>{saved=value;}},
   onPageLoad:(_key,setup)=>setup(new AbortController().signal),
   fetch:async(_url,options)=>{request=options;return new Response(JSON.stringify({views:12}));}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(request.method,method);assert.equal(item.textContent,'阅读量 12');
  if(method==='POST')assert.equal(saved,today);
 }
});

test('clipboard success is reported only after a successful write; denial never rejects',async()=>{
 let written;
 const ok=load('src/lib/clipboard.ts',{navigator:{clipboard:{writeText:async value=>{written=value;}}}});
 assert.equal(await ok.copyText('known'),true);assert.equal(written,'known');
 for(const navigator of [{},{clipboard:{writeText:async()=>{throw Error('denied');}}},Object.defineProperty({},'clipboard',{get(){throw Error('denied');}})]) {
  assert.equal(await load('src/lib/clipboard.ts',{navigator}).copyText('known'),false);
 }
});
