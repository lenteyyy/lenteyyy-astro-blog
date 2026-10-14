import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {deploymentFiles} from '../scripts/deployment-files.mjs';import {hardenBuildRoutes} from '../scripts/harden-build-routes.mjs';
test('API payload excludes nested credentials, internal source snapshots, tests and infrastructure',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'deployment-boundary-'));
 try{
  execFileSync('git',['init','-q',root]);
  fs.writeFileSync(path.join(root,'.vercelignore'),'.env*\n**/.env*\n!/.env.example\n*.log\ndocs\ntests\ninfra\n');
  for(const file of ['src/app.ts','src/nested/.env.production','src/nested/.env.example','src/debug.log','src/docs/internal.md','public/icon.svg','tests/private.test.mjs','infra/schema.sql','docs/security.md','.env.example','package.json']){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),'fixture');}
  const files=deploymentFiles(root);for(const file of ['src/app.ts','public/icon.svg','.env.example','package.json'])assert.ok(files.includes(file));
  assert.ok(!files.some(file=>file.includes('nested/.env')||file.includes('/docs/')||file.startsWith('tests/')||file.startsWith('infra/')||file.startsWith('docs/')||file.endsWith('.log')));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('canonical slash redirects cannot produce external protocol-relative destinations',()=>{
 const config=hardenBuildRoutes({routes:[{src:'^/(.*)/$',headers:{Location:'/$1'},status:308}]});const expression=new RegExp(config.routes[0].src);
 for(const input of ['/posts/article/','/zh-tw/posts/article/','/dictation/']){const match=expression.exec(input);assert.ok(match);const location=config.routes[0].headers.Location.replace('$1',match[1]);assert.equal(new URL(location,'https://example.test').origin,'https://example.test');}
 for(const input of ['//evil.test/','///evil.test/','/\\evil.test/','/\t/evil.test/','/\n/evil.test/'])assert.equal(expression.exec(input),null);
 assert.deepEqual(hardenBuildRoutes(config),config);
 assert.throws(()=>hardenBuildRoutes({routes:[{src:'unknown',headers:{Location:'/$1'},status:308}]}));
});
