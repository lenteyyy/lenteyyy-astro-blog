import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadRedis(url, fetch, address = '127.0.0.1', token = 'test-only-token') {
 const source=fs.readFileSync('src/lib/rate-limit.ts','utf8').replace(/^import .*;\n/gm,'').replaceAll('import.meta.env','env');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,URL,AbortSignal,TextEncoder,crypto,fetch,rateLimitAddress:()=>address,env:{KV_REST_API_URL:url,KV_REST_API_TOKEN:token}});return exports;
}

test('Redis credentials cannot be sent to arbitrary, plaintext, credentialed or path-based endpoints',async()=>{
 for(const url of ['http://example.upstash.io','https://example.test','https://example.upstash.io.evil.test','https://user:password@example.upstash.io','https://example.upstash.io/path','https://example.upstash.io/?redirect=1','https://127.0.0.1']){
  const redis=loadRedis(url,async()=>assert.fail('Credentials reached an unapproved endpoint'));
  await assert.rejects(redis.redis(['GET','test']));
 }
});

test('visitor identifiers are keyed, scoped, bounded and never contain IPs or credentials',async()=>{
 const keys=[];
 const capture=async(_url,init)=>{keys.push(JSON.parse(init.body));return new Response(JSON.stringify({result:1}));};
 const request=new Request('https://example.test');
 const one=loadRedis('https://example.upstash.io',capture,'192.0.2.42','test-only-token-one');
 await one.recordDailyView(request,'known');await one.recordDailyView(request,'known');await one.recordDailyView(request,'other');
 const otherAddress=loadRedis('https://example.upstash.io',capture,'192.0.2.43','test-only-token-one');await otherAddress.recordDailyView(request,'known');
 const otherSecret=loadRedis('https://example.upstash.io',capture,'192.0.2.42','test-only-token-two');await otherSecret.recordDailyView(request,'known');
 assert.equal(keys[0][4],keys[1][4]);
 for(const index of [2,3,4])assert.notEqual(keys[0][4],keys[index][4]);
 const day=new Date().toISOString().slice(0,10),plain=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`view|known|${day}|192.0.2.42`));
 const plainHash=Buffer.from(plain).toString('hex');assert.ok(!keys[0][4].endsWith(plainHash));
 for(const command of keys){assert.doesNotMatch(JSON.stringify(command),/192\.0\.2\.|test-only-token/);assert.equal(command[5],'90000');}
 await one.withinRateLimit(request,'views',90,60);assert.equal(keys.at(-1)[4],'65');
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
