import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {PrivateRequestScope} from '../src/lib/ielts/private-request-scope.ts';
import {json,cleanText} from '../src/lib/ielts/http.ts';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const evaluate=(path,context={})=>{
 const exports={};const code=ts.transpileModule(source(path).replace(/^import .*;\n/gm,'').replaceAll('import.meta.env.PROD','true'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,Response,Request,URL,TextEncoder,TextDecoder,crypto,...context});return exports;
};
test('logout/account switch aborts requests and invalidates even non-abortable late responses',()=>{
 const scope=new PrivateRequestScope(),old=scope.capture();assert.ok(scope.current(old));scope.invalidate();
 assert.ok(old.signal.aborted);assert.equal(scope.current(old),false);const current=scope.capture();assert.ok(scope.current(current));
 scope.invalidate();assert.equal(scope.current(current),false);assert.equal(scope.current(old),false);
});
test('valid SDK-verified identity never trusts role metadata or writes a profile on a GET',async()=>{
 for(const owner of [false,true]){
  let writes=0,limits=0;const auth=evaluate('src/lib/ielts/auth.ts',{
   isAdminEmail:email=>email==='owner@example.test',claimRateLimit:async()=>{limits++;return true;},
   createPublicClient:()=>({auth:{getUser:async()=>({data:{user:{id:'u',email:owner?'OWNER@example.test':'student@example.test',email_confirmed_at:'2026-10-11',user_metadata:{role:'admin'}}}})}}),
   createServiceClient:()=>{writes++;throw Error('unexpected write');},
  });
  const result=await auth.getAuthContext({get:name=>name.includes('access')?{value:'aaa.bbb.ccc'}:undefined},new Request('https://www.lenteyyy.com'));
  assert.equal(result.role,owner?'admin':'student');assert.equal(writes,0);assert.equal(limits,1);
 }
});
test('malformed and oversized authentication cookies stop before upstream requests',async()=>{
 for(const token of ['garbage','a.b','a.b.c.d','aaa.bbb.<script>','x'.repeat(4097)]){
  let calls=0,clears=0;const auth=evaluate('src/lib/ielts/auth.ts',{
   createPublicClient:()=>{calls++;throw Error('unexpected call');},claimRateLimit:async()=>{calls++;return true;},
  });
  assert.equal(await auth.getAuthContext({get:name=>name.includes('access')?{value:token}:undefined,delete:()=>clears++},new Request('https://www.lenteyyy.com')),undefined);
  assert.equal(calls,0);assert.equal(clears,2);
 }
});
test('session request saturation fails closed before Supabase token verification',async()=>{
 let calls=0;const auth=evaluate('src/lib/ielts/auth.ts',{
  claimRateLimit:async()=>false,createPublicClient:()=>{calls++;throw Error('unexpected provider request');},
 });
 await assert.rejects(auth.getAuthContext({get:name=>name.includes('access')?{value:'a.b.c'}:undefined},new Request('https://www.lenteyyy.com')),/rate_limited/);assert.equal(calls,0);
});
test('logout rejects malformed cookies before provider calls and limits valid-shaped attempts',async()=>{
 let calls=0,limits=0;const auth=evaluate('src/lib/ielts/auth.ts',{
  claimRateLimit:async()=>{limits++;return false;},createPublicClient:()=>{calls++;throw Error('unexpected provider request');},
 });
 const request=new Request('https://www.lenteyyy.com');
 await auth.revokeAuthSession({get:name=>name.includes('access')?{value:'malformed'}:undefined},request);
 assert.equal(calls,0);assert.equal(limits,0);
 await assert.rejects(auth.revokeAuthSession({get:name=>name.includes('access')?{value:'a.b.c'}:undefined},request),/rate_limited/);
 assert.equal(calls,0);assert.equal(limits,1);
});
test('IP denial prevents attacker-selected email rows and provider/verification requests',async()=>{
 for(const [path,scope] of [['src/pages/api/ielts/auth/login.ts','password-login-ip'],['src/pages/api/ielts/auth/verify-code.ts','otp-verify-ip']]){
  const calls=[];let sideEffects=0;const handler=evaluate(path,{
   json,sameOrigin:()=>true,normalizeEmail:x=>x,readJson:async()=>({email:'rotated@example.test',password:'longpassword1',code:'123456',legalConsent:true}),
   claimRateLimit:async(_r,name)=>{calls.push(name);return false;},createPublicClient:()=>{sideEffects++;},createServiceClient:()=>{sideEffects++;},
  });
  assert.equal((await handler.POST({request:{}})).status,429);assert.deepEqual(calls,[scope]);assert.equal(sideEffects,0);
 }
});
test('booking update repeats the record owner predicate in its atomic compare-and-set',async()=>{
 let stage=0;const filters=[];const query={select(){return this;},eq(...args){filters.push([stage,...args]);return this;},update(){stage=1;return this;},maybeSingle:async()=>stage?{data:null,error:null}:{data:{user_id:'owner-id',status:'pending'},error:null}};
 const handler=evaluate('src/pages/api/ielts/bookings.ts',{
  json,sameOrigin:()=>true,getAuthContext:async()=>({user:{id:'owner-id'},role:'student'}),claimRateLimit:async()=>true,
  readJson:async()=>({id:'11111111-1111-4111-8111-111111111111',action:'cancel'}),createServiceClient:()=>({from:()=>query}),
 });
 assert.equal((await handler.PATCH({request:{},cookies:{}})).status,409);assert.ok(filters.some(([s,key,value])=>s===1&&key==='user_id'&&value==='owner-id'));
});
test('private JSON prevents browser and shared CDN caching',()=>{
 for(const status of [200,401,403,503]){const headers=json({},status).headers;assert.match(headers.get('cache-control'),/no-store/);assert.equal(headers.get('cdn-cache-control'),'no-store');assert.equal(headers.get('vercel-cdn-cache-control'),'no-store');assert.equal(headers.get('vary'),'Cookie');}
});
test('failed concurrent material publication never deletes storage objects',async()=>{
 for(const suffix of ['file.pdf','.','..','nested/file.pdf','nested\\file.pdf']){
  let touched=0;const handler=evaluate('src/pages/api/ielts/materials/index.ts',{
   json,cleanText,sameOrigin:()=>true,getAuthContext:async()=>({user:{id:'owner'},role:'admin'}),claimRateLimit:async()=>true,
   readJson:async()=>({storagePath:`2026-10-11/11111111-1111-4111-8111-111111111111/${suffix}`}),createServiceClient:()=>{touched++;throw Error('unexpected deletion');},
  });
  assert.equal((await handler.POST({request:{},cookies:{}})).status,400);assert.equal(touched,0);
 }
 let inserts=0,removals=0;
 const failedPublish=evaluate('src/pages/api/ielts/materials/index.ts',{
  json,cleanText,sameOrigin:()=>true,getAuthContext:async()=>({user:{id:'owner'},role:'admin'}),claimRateLimit:async()=>true,
  readJson:async()=>({title:'Material',category:'阅读',storagePath:'2026-10-11/11111111-1111-4111-8111-111111111111/file.pdf',fileName:'file.pdf',mimeType:'application/pdf',sizeBytes:1024}),
  createServiceClient:()=>({storage:{from:()=>({exists:async()=>({data:true,error:null}),remove:async()=>{removals++;}})},from:()=>({insert:()=>{inserts++;return{select:()=>({single:async()=>({data:null,error:Error('concurrent insert failed')})})};}})}),
 });
 assert.equal((await failedPublish.POST({request:{},cookies:{}})).status,503);
 assert.equal(inserts,1);assert.equal(removals,0);
 assert.doesNotMatch(source('src/pages/api/ielts/materials/index.ts'),/\.remove\(/);
});
test('dot filenames cannot create storage traversal targets',()=>{
 const security=evaluate('src/lib/ielts/security.ts');for(const name of ['.','..',' ', '\u0000'])assert.ok(!['.','..',''].includes(security.safeFileName(name)));
});
test('private screens invalidate on navigation/BFCache and cross-tab session changes',()=>{
 for(const path of ['src/pages/ielts/index.astro','src/pages/ielts/management.astro']){
  const s=source(path);for(const marker of ['PrivateRequestScope','BroadcastChannel','pagehide','pageshow','event.persisted'])assert.ok(s.includes(marker));
 }
 for(const path of ['src/pages/ielts/management.astro','src/pages/ielts/entry-test.astro','src/pages/ielts/mock/[paper].astro']){
  const s=source(path);assert.ok(s.indexOf('"CDN-Cache-Control"')<s.indexOf('getAuthContext(Astro.cookies'));
 }
});
