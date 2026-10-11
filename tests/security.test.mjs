import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { Marked } from 'marked';
import { readJson, sameOrigin, cleanLine, cleanText } from '../src/lib/ielts/http.ts';
import { isBookableDate, bookingWindow } from '../src/lib/ielts/booking-window.ts';
import { rateLimitAddress } from '../src/lib/ielts/rate-policy.ts';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const evaluate = (path, context = {}) => {
  const exports = {};
  const code = ts.transpileModule(source(path).replace(/^import .*;\n/gm, '').replaceAll('import.meta.env.PROD', 'true'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, Response, Request, URL, TextEncoder, TextDecoder, crypto, ...context });
  return exports;
};
const request = body => new Request('https://www.lenteyyy.com/api/test', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body,
});

test('JSON bodies are bounded while streaming, including multibyte and chunked requests', async () => {
  assert.deepEqual(await readJson(request('{"ok":true}')), { ok: true });
  await assert.rejects(readJson(request('{"x":"汉字"}'), 10), /payload_too_large/);
  let reads = 0, cancelled = false;
  const stream = new ReadableStream({
    pull(controller) { reads++; controller.enqueue(new Uint8Array(1024)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(readJson(new Request('https://www.lenteyyy.com/api/test', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: stream, duplex: 'half',
  }), 1500), /payload_too_large/);
  assert.equal(cancelled, true);
  assert.ok(reads <= 3, 'stop before buffering the rest of the stream');
  for (const value of ['', 'null', 'true', '[]', '"text"', '{bad']) {
    await assert.rejects(readJson(request(value)), /invalid_json/);
  }
  await assert.rejects(readJson(new Request('https://www.lenteyyy.com', {
    method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}',
  })), /invalid_content_type/);
});

test('CSRF checks reject cross-origin, missing and malformed origins', () => {
  for (const origin of ['', 'null', 'https://www.lenteyyy.com.attacker.test', 'http://www.lenteyyy.com']) {
    assert.equal(sameOrigin(new Request('https://www.lenteyyy.com/api/test', { headers: origin ? { origin } : {} })), false);
  }
  assert.equal(sameOrigin(new Request('https://www.lenteyyy.com/api/test', { headers: { origin: 'https://www.lenteyyy.com' } })), true);
});

test('changing user-agent or arbitrary Cloudflare headers cannot reset main-site limits', () => {
  const a = new Request('https://www.lenteyyy.com', { headers: { 'x-vercel-forwarded-for': '192.0.2.1', 'cf-connecting-ip': '192.0.2.2', 'user-agent': 'a' } });
  const b = new Request('https://www.lenteyyy.com', { headers: { 'x-vercel-forwarded-for': '192.0.2.1', 'cf-connecting-ip': '192.0.2.3', 'user-agent': 'b' } });
  assert.equal(rateLimitAddress(a), rateLimitAddress(b));
  const main = source('src/lib/rate-limit.ts');
  assert.match(main, /rateLimitAddress\(request\)/);
  assert.doesNotMatch(main, /cf-connecting-ip|user-agent|x-real-ip/);
});

test('unverified sessions cannot read private data or gain owner access', async () => {
  for (const email of ['lenteyteytey@gmail.com', 'student@example.test']) {
    let writes = 0, clears = 0;
    const auth = evaluate('src/lib/ielts/auth.ts', {
      isAdminEmail: value => value === 'lenteyteytey@gmail.com',
      createPublicClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u', email, email_confirmed_at: null } } }) } }),
      createServiceClient: () => { writes++; throw new Error('Unexpected private write'); },
    });
    const cookies = { get: () => ({ value: 'test' }), delete: () => { clears++; } };
    assert.equal(await auth.getAuthContext(cookies), undefined);
    assert.equal(writes, 0);
    assert.equal(clears, 2);
  }
});

test('global email budgets stop distributed spam before creating codes or sending mail', async () => {
  for (const denied of ['otp-global-hour', 'otp-global-day']) {
    let sideEffects = 0;
    const unexpected = () => { sideEffects++; throw new Error('Unexpected mail or database write'); };
    const handler = evaluate('src/pages/api/ielts/auth/request-code.ts', {
      sameOrigin: () => true, readJson: async () => ({ email: 'test@example.test', legalConsent: true }),
      normalizeEmail: value => value, claimRateLimit: async (_request, scope) => scope !== denied,
      createSixDigitCode: unexpected, createServiceClient: unexpected, sendLoginCode: unexpected,
      json: (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers }),
    });
    const response = await handler.POST({ request: {} });
    assert.equal(response.status, 429);
    assert.equal(sideEffects, 0);
    assert.equal(response.headers.get('retry-after'), '60');
  }
});

test('markdown and URLs cannot inject active HTML or unsafe navigation', () => {
  const markdown = evaluate('src/lib/markdown.ts', { Marked, mediaManifest: {}, translateText: text => text });
  for (const value of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '//attacker.test', '/\\attacker.test', 'https:\\attacker.test', 'java\nscript:alert(1)']) {
    assert.equal(markdown.safeLinkUrl(value), '', value);
  }
  const html = markdown.renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[attack](javascript:alert%281%29)\n\n![x](data:text/html,bad)');
  assert.doesNotMatch(html, /<script\b|<img\b|href="javascript:|src="data:/i);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(markdown.safeLinkUrl('/ielts'), '/ielts');
});

test('database migrations prevent direct browser writes from bypassing server validation', () => {
  for (const path of ['infra/ielts-schema.sql', 'infra/ielts-security-20261007.sql']) {
    const sql = source(path);
    assert.match(sql, /revoke all on table public\.ielts_profiles, public\.ielts_materials,[\s\S]*?public\.ielts_bookings, public\.ielts_rate_limits[\s\S]*?from public, anon, authenticated/);
    assert.doesNotMatch(sql, /create policy "users create own IELTS bookings"/);
  }
});

test('students cannot confirm appointments, cancel others, or access owner upload endpoints', async () => {
  const auth = { user: { id: 'student' }, email: 'student@example.test', role: 'student' };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
  let writes = 0;
  const query = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { user_id: 'other', email: 'other@example.test', status: 'pending' }, error: null }), update() { writes++; throw new Error('Unexpected write'); } };
  let body = { id: '11111111-1111-4111-8111-111111111111', action: 'confirm' };
  const handler = evaluate('src/pages/api/ielts/bookings.ts', {
    json, sameOrigin: () => true, getAuthContext: async () => auth,
    claimRateLimit: async () => true, readJson: async () => body,
    createServiceClient: () => ({ from: () => query }),
  });
  assert.equal((await handler.PATCH({ request: {}, cookies: {} })).status, 403);
  body.action = 'cancel';
  assert.equal((await handler.PATCH({ request: {}, cookies: {} })).status, 403);
  assert.equal(writes, 0);
  for (const path of ['src/pages/api/ielts/materials/index.ts', 'src/pages/api/ielts/materials/upload-url.ts']) {
    const upload = evaluate(path, { json, sameOrigin: () => true, getAuthContext: async () => auth, createServiceClient: () => { throw new Error('Unexpected owner access'); } });
    assert.equal((await upload.POST({ request: {}, cookies: {} })).status, 403);
  }
});

test('student booking responses filter by owner and never disclose contact data', async () => {
  const filters = [];
  const query = { select() { return this; }, order() { return this; }, limit() { return this; }, eq(...args) { filters.push(args); return this; }, then(resolve) { resolve({ data: [{ id: 'booking', email: 'private@example.test', name: 'Private name', contact: 'Private phone', notes: 'Private note', status: 'pending', lesson_time: '8:30–10:00' }], error: null }); } };
  const handler = evaluate('src/pages/api/ielts/bookings.ts', {
    getAuthContext: async () => ({ user: { id: 'student' }, role: 'student' }),
    createServiceClient: () => ({ from: () => query }),
    json: (body, status = 200) => new Response(JSON.stringify(body), { status }),
  });
  const response = await handler.GET({ request: new Request('https://www.lenteyyy.com/api/ielts/bookings?scope=admin'), cookies: {} });
  assert.deepEqual(filters, [['user_id', 'student']]);
  const text = await response.text();
  assert.doesNotMatch(text, /private@example|Private name|Private phone|Private note/);
  assert.equal(response.status, 200);
});

test('invalid, duplicated, distant and excessive batch bookings cause no writes or mail', async () => {
  const date = bookingWindow().first;
  const item = { date, time: '8:30–10:00', subject: '阅读' };
  let body;
  let effects = 0;
  const unexpected = () => { effects++; throw new Error('Unexpected database or mail'); };
  const handler = evaluate('src/pages/api/ielts/bookings.ts', {
    sameOrigin: () => true, getAuthContext: async () => ({ user: { id: 'student' }, email: 'student@example.test', role: 'student' }),
    claimRateLimit: async () => true, readJson: async () => body, cleanLine, cleanText, isBookableDate,
    createServiceClient: unexpected, sendBookingEmails: unexpected,
    json: (value, status = 200) => new Response(JSON.stringify(value), { status }),
  });
  for (const bookings of [[], Array(5).fill(item), [item, item], [{ ...item, date: '2099-01-01' }], [{ ...item, date: '2026-02-30' }], [{ ...item, time: '其他时间', customTime: '' }]]) {
    body = { name: 'Test', consent: true, bookings };
    assert.equal((await handler.POST({ request: {}, cookies: {} })).status, 400);
  }
  assert.equal(effects, 0);
});

test('production session cookies are host-bound, secure, HttpOnly and strict', () => {
 const auth=evaluate('src/lib/ielts/auth.ts');const sets=[],deletes=[];
 const cookies={set:(...args)=>sets.push(args),delete:(...args)=>deletes.push(args)};
 auth.setAuthSession(cookies,{access_token:'access-test',refresh_token:'refresh-test',expires_in:3600});
 assert.deepEqual(sets.map(([name])=>name),['__Host-ielts_access','__Host-ielts_refresh']);
 for(const [, , options] of sets){assert.equal(options.secure,true);assert.equal(options.httpOnly,true);assert.equal(options.sameSite,'strict');assert.equal(options.path,'/');assert.equal(options.domain,undefined);}
 assert.deepEqual(deletes.map(([name])=>name),['ielts_access','ielts_refresh']);
});

test('logout revokes only the current refresh session, refreshing an expired access token if needed',async()=>{
 for(const expired of [false,true]){
  const calls=[];
  const auth=evaluate('src/lib/ielts/auth.ts',{
   createPublicClient:()=>({auth:{getUser:async()=>({data:{user:expired?null:{id:'u'}}}),refreshSession:async input=>{calls.push(input.refresh_token);return {data:{session:{access_token:'new-test'}},error:null};}}}),
   createServiceClient:()=>({auth:{admin:{signOut:async(...args)=>{calls.push(args);return {error:null};}}}}),
  });
  await auth.revokeAuthSession({get:name=>({value:name.includes('refresh')?'refresh-test':'header.payload.signature'})});
  assert.equal(calls.length,expired?2:1);assert.deepEqual(Array.from(calls.at(-1)),[expired?'new-test':'header.payload.signature','local']);
 }
});

test('logout failure clears browser auth and PKCE cookies but reports failure; CSRF does neither',async()=>{
 for(const forbidden of [false,true]){
  let clears=0,revocations=0;
  const handler=evaluate('src/pages/api/ielts/auth/logout.ts',{
   sameOrigin:()=>!forbidden,revokeAuthSession:async()=>{revocations++;throw Error('provider unavailable');},
   clearAuthSession:()=>clears++,clearOAuthPending:()=>clears++,json:(body,status=200)=>new Response(JSON.stringify(body),{status}),
  });
  assert.equal((await handler.POST({request:{},cookies:{}})).status,forbidden?403:503);
  assert.equal(clears,forbidden?0:2);assert.equal(revocations,forbidden?0:1);
 }
});

test('logout cannot report successful revocation when refresh produces no session',async()=>{
 const auth=evaluate('src/lib/ielts/auth.ts',{
  createPublicClient:()=>({auth:{getUser:async()=>({data:{user:null}}),refreshSession:async()=>({data:{session:null},error:null})}}),
 });
 await assert.rejects(auth.revokeAuthSession({get:name=>({value:name.includes('refresh')?'refresh-test':'header.payload.signature'})}),/logout_unavailable/);
});

test('a stale failed OTP cannot increment a replacement challenge or overwrite a newer attempt count',async()=>{
 const filters=[];
 const challenge={code_hash:'old-challenge',expires_at:new Date(Date.now()+60000).toISOString(),attempts:2};
 const query={select(){return this;},eq(...args){filters.push(args);return this;},maybeSingle:async()=>({data:challenge,error:null}),update(){return this;},then(resolve){resolve({error:null});}};
 const handler=evaluate('src/pages/api/ielts/auth/verify-code.ts',{
  sameOrigin:()=>true,readJson:async()=>({email:'student@example.test',code:'123456',password:'Password123',legalConsent:true}),normalizeEmail:x=>x,
  claimRateLimit:async()=>true,sha256:async()=> 'email-hash',verificationHash:async()=> 'different-challenge',constantTimeEqual:(a,b)=>a===b,ieltsConfig:()=>({secretKey:'test-secret'}),
  createServiceClient:()=>({from:()=>query}),json:(body,status=200)=>new Response(JSON.stringify(body),{status}),
 });
 assert.equal((await handler.POST({request:{},cookies:{}})).status,401);
 assert.deepEqual(filters,[['email_hash','email-hash'],['email_hash','email-hash'],['code_hash','old-challenge'],['attempts',2]]);
});

test('failed OTP delivery deletes only its exact challenge, never a later replacement',async()=>{
 const filters=[];
 const query={delete(){return this;},lt(){return Promise.resolve({error:null});},eq(...args){filters.push(args);return this;},upsert:async()=>({error:null}),then(resolve){resolve({error:null});}};
 const handler=evaluate('src/pages/api/ielts/auth/request-code.ts',{
  sameOrigin:()=>true,readJson:async()=>({email:'student@example.test',legalConsent:true}),normalizeEmail:x=>x,claimRateLimit:async()=>true,
  createSixDigitCode:()=> '123456',sha256:async()=> 'email-hash',verificationHash:async()=> 'own-challenge',ieltsConfig:()=>({secretKey:'test-secret'}),sendLoginCode:async()=>{throw Error('mail offline');},
  createServiceClient:()=>({from:()=>query}),json:(body,status=200)=>new Response(JSON.stringify(body),{status}),
 });
 assert.equal((await handler.POST({request:{}})).status,503);assert.deepEqual(filters,[['email_hash','email-hash'],['code_hash','own-challenge']]);
});

test('availability discloses only occupied times inside the current booking window',async()=>{
 const filters=[];let queries=0;
 const query={select(){return this;},gte(...args){filters.push(args);return this;},lte(...args){filters.push(args);return this;},lt(){return this;},neq(){return this;},in(){return Promise.resolve({data:[],error:null});}};
 const handler=evaluate('src/pages/api/ielts/availability.ts',{
  claimRateLimit:async()=>true,bookingWindow:()=>({first:'2026-10-11',last:'2026-12-11'}),
  createServiceClient:()=>({from:()=>{queries++;return query;}}),json:(body,status=200)=>new Response(JSON.stringify(body),{status}),
 });
 for(const month of ['2025-10','2026-09','2027-01','2026-13','2026-10&scope=admin']){
  const response=await handler.GET({request:new Request(`https://www.lenteyyy.com/api/ielts/availability?month=${encodeURIComponent(month)}`)});assert.equal(response.status,400);
 }
 assert.equal(queries,0);
 assert.equal((await handler.GET({request:new Request('https://www.lenteyyy.com/api/ielts/availability?month=2026-10')})).status,200);
 assert.deepEqual(filters,[['lesson_date','2026-10-01'],['lesson_date','2026-10-11'],['lesson_date','2026-12-11']]);
});

test('recreated email accounts cannot cancel records owned by an earlier user ID',async()=>{
 let writes=0;
 const query={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{user_id:'old-id',email:'same@example.test',status:'pending'},error:null}),update(){writes++;return this;}};
 const handler=evaluate('src/pages/api/ielts/bookings.ts',{
  sameOrigin:()=>true,getAuthContext:async()=>({user:{id:'new-id'},email:'same@example.test',role:'student'}),claimRateLimit:async()=>true,
  readJson:async()=>({id:'11111111-1111-4111-8111-111111111111',action:'cancel'}),createServiceClient:()=>({from:()=>query}),json:(body,status=200)=>new Response(JSON.stringify(body),{status}),
 });
 assert.equal((await handler.PATCH({request:{},cookies:{}})).status,403);assert.equal(writes,0);
});

test('failed upload cleanup never deletes an existing published file or a file whose references are unknown',async()=>{
 for(const unavailable of [false,true]){
  let removed=0;
  const query={select(){return this;},eq(){return this;},limit:async()=>({data:unavailable?null:[{id:'published'}],error:unavailable?Error('offline'):null})};
  const handler=evaluate('src/pages/api/ielts/materials/index.ts',{
   sameOrigin:()=>true,getAuthContext:async()=>({role:'admin',user:{id:'owner'}}),claimRateLimit:async()=>true,
   readJson:async()=>({storagePath:'2026-10-11/11111111-1111-4111-8111-111111111111/file.pdf'}),cleanText,
   createServiceClient:()=>({from:()=>query,storage:{from:()=>({remove:async()=>{removed++;}})}}),json:(body,status=200)=>new Response(JSON.stringify(body),{status}),
  });
  assert.equal((await handler.POST({request:{},cookies:{}})).status,400);assert.equal(removed,0);
 }
});

test('rate-limit keys cannot reset at a wall-clock boundary and DB failures fail closed',async()=>{
 const keys=[];let failure=false;let time=59000;
 const security=evaluate('src/lib/ielts/security.ts',{
  Date:class extends Date{static now(){return time;}},rateLimitAddress:()=> '192.0.2.1',
  createServiceClient:()=>({rpc:async(_name,args)=>{keys.push(args.p_key_hash);return {data:!failure,error:failure?Error('offline'):null};}}),
 });
 await security.claimRateLimit({},'otp-email-cooldown','same@example.test',1,60,'identity');time=61000;
 await security.claimRateLimit({},'otp-email-cooldown','same@example.test',1,60,'identity');assert.equal(keys[0],keys[1]);
 failure=true;await assert.rejects(security.claimRateLimit({},'otp-ip','',10,3600,'request'),/rate_limit_unavailable/);
});

test('JSON media type lookalikes cannot bypass the content type check',async()=>{
 for(const type of ['application/json-evil','application/jsonp','application/json+xml'])await assert.rejects(readJson(new Request('https://www.lenteyyy.com',{method:'POST',headers:{'content-type':type},body:'{}'})),/invalid_content_type/);
 assert.deepEqual(await readJson(new Request('https://www.lenteyyy.com',{method:'POST',headers:{'content-type':'Application/JSON; charset=utf-8'},body:'{}'})),{});
});

test('IELTS CSP blocks executable inline scripts and prevents framing without breaking inert exam JSON',()=>{
 const config=JSON.parse(source('vercel.json'));const headers=config.headers.find(h=>h.source==='/ielts(.*)').headers;
 const policy=headers.find(h=>h.key==='Content-Security-Policy').value;
 assert.match(policy,/script-src 'self' 'sha256-/);assert.doesNotMatch(policy,/script-src[^;]*(?:unsafe-inline|unsafe-eval)/);assert.match(policy,/frame-ancestors 'none'/);assert.match(policy,/object-src 'none'/);
 assert.match(source('src/layouts/IeltsLayout.astro'),/<script is:inline src="\/ielts\/theme\.js"><\/script>/);assert.match(source('src/pages/ielts/entry-test.astro'),/Astro\.cookies\.has\(cookieNames\.access\)/);
});
