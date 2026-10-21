import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadRedis(url, fetch) {
 const source=fs.readFileSync('src/lib/rate-limit.ts','utf8').replace(/^import .*;\n/gm,'').replaceAll('import.meta.env','env');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,URL,AbortSignal,TextEncoder,crypto,fetch,rateLimitAddress:()=> '127.0.0.1',env:{KV_REST_API_URL:url,KV_REST_API_TOKEN:'test-only-token'}});return exports;
}

test('Redis credentials cannot be sent to arbitrary, plaintext, credentialed or path-based endpoints',async()=>{
 for(const url of ['http://example.upstash.io','https://example.test','https://example.upstash.io.evil.test','https://user:password@example.upstash.io','https://example.upstash.io/path','https://example.upstash.io/?redirect=1','https://127.0.0.1']){
  const redis=loadRedis(url,async()=>assert.fail('Credentials reached an unapproved endpoint'));
  await assert.rejects(redis.redis(['GET','test']));
 }
});

test('Redis fetches have a deadline, refuse redirects and reject command error payloads',async()=>{
 let options;const ok=loadRedis('https://example.upstash.io',async(_url,init)=>{options=init;return new Response(JSON.stringify({result:'12'}));});
 assert.equal((await ok.redis(['GET','test'])).result,'12');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.ok(options.signal instanceof AbortSignal);
 for(const body of [{error:'ERR command rejected'}, {}, null]){
  const broken=loadRedis('https://example.upstash.io',async()=>new Response(JSON.stringify(body)));
  await assert.rejects(broken.redis(['GET','test']));
 }
});

test('invalid rate counts never silently authorize a view',async()=>{
 for(const result of [0,-1,'nonnumeric',{},null,Number.MAX_SAFE_INTEGER+1]){
  const broken=loadRedis('https://example.upstash.io',async()=>new Response(JSON.stringify({result})));
  await assert.rejects(broken.withinRateLimit(new Request('https://example.test'),'views',90,60));
 }
});

test('daily counting and visitor deduplication use a single atomic Redis operation',async()=>{
 const commands=[];
 const store=loadRedis('https://example.upstash.io',async(_url,init)=>{commands.push(JSON.parse(init.body));return new Response(JSON.stringify({result:13}));});
 assert.equal((await store.recordDailyView(new Request('https://example.test'),'known')).result,13);
 assert.equal(commands.length,1);
 const [operation,script,keyCount,counter,claim,expiry]=commands[0];
 assert.equal(operation,'EVAL');assert.equal(keyCount,'2');assert.equal(counter,'post:views:known');assert.equal(expiry,'90000');
 assert.match(claim,/^post:viewed:known:\d{4}-\d{2}-\d{2}:[a-f0-9]{64}$/);
 assert.ok(script.indexOf("redis.call('INCR'")<script.indexOf("redis.call('SET'"));
 assert.match(script,/EXISTS.*GET/s);
 await store.recordDailyView(new Request('https://example.test'),'known');assert.equal(commands[1][4],claim);
 const broken=loadRedis('https://example.upstash.io',async()=>{throw Error('upstream unavailable');});
 await assert.rejects(broken.recordDailyView(new Request('https://example.test'),'known'));
});
