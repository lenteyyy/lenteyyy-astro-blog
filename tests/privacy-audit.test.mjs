import test from 'node:test';
import assert from 'node:assert/strict';
import { secretFindings } from '../scripts/secret-patterns.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('credential scanner covers key families and reports categories without returning secret values',()=>{
 const samples=[
  ['gh'+'p_'+'Az5cN8vK2wQ6rT9bX4dE'.repeat(2),'GitHub credential'],
  ['-----BEGIN '+'PRIVATE KEY-----','private key'],
  ['AK'+'IA'+'ABCD1234EFGH5678','AWS access key'],
  ['sk_'+'live_'+'Az5cN8vK2wQ6rT9bX4dE'.repeat(2),'service credential'],
  ['AIza'+'A'.repeat(35),'Google API key'],
  ['postgres'+'ql://admin:privatepass@database.internal/db','database credential URL'],
 ];
 for(const [secret,kind]of samples){const result=secretFindings(secret);assert.ok(result.includes(kind));assert.ok(!JSON.stringify(result).includes(secret));}
 const secret='opaque'+'-credential-value-123456789';assert.deepEqual(secretFindings(secret,[secret]),['known local secret literal']);
 assert.deepEqual(secretFindings('https://www.lenteyyy.com lenteyteytey@gmail.com PUBLIC_GISCUS_REPO_ID=R_kgDOTUY6Bg'),[]);
 const payload=Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url');
 assert.deepEqual(secretFindings('eyJhbGciOiJIUzI1NiJ9.'+payload+'.signature'),['service role JWT']);
});

test('public secret scanning also works for deployment uploads without Git metadata',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'blog-no-git-audit-'));
 try {
  for(const folder of ['public','src','dist/client'])fs.mkdirSync(path.join(root,folder),{recursive:true});
  const script=path.resolve('scripts/security-audit.mjs');
  const run=()=>spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'});
  assert.equal(run().status,0);
  const secret='gh'+'p_'+'Az5cN8vK2wQ6rT9bX4dE'.repeat(2);
  fs.writeFileSync(path.join(root,'dist/client','leak.js'),`const leaked='${secret}';`);
  const result=run();assert.equal(result.status,1);assert.match(result.stderr,/GitHub credential: dist/);assert.ok(!result.stderr.includes(secret));
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
