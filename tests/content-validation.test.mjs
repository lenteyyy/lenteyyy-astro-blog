import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

test('publication validation rejects broken tag paths and impossible calendar dates',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'blog-content-validation-'));
 try {
  fs.mkdirSync(path.join(root,'content','posts'),{recursive:true});
  fs.writeFileSync(path.join(root,'content','media-manifest.json'),'{}');
  for(const [tag,date,valid] of [['生活','2026-10-18',true],['#不知道写啥','2026-10-18',false],['a/b','2026-10-18',false],['生活','2026-02-30',false],['生活','2026-99-01',false]]){
   fs.writeFileSync(path.join(root,'content','posts','known.md'),`---\ntitle: Known\nslug: known\ndate: ${date}\ncategory: 个人杂谈\nstatus: published\ntags:\n  - "${tag}"\n---\n\nA published article.\n`);
   const result=spawnSync(process.execPath,[path.resolve('scripts/validate-content.mjs')],{cwd:root,encoding:'utf8'});
   assert.equal(result.status,valid?0:1,result.stderr);
   if(!valid)assert.match(result.stderr,/invalid date|tags must be plain labels/);
  }
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('publication validation distinguishes code examples from assets and rejects inherited or unsafe media entries',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'blog-media-validation-'));
 try {
  fs.mkdirSync(path.join(root,'content','posts'),{recursive:true});
  const header='---\ntitle: Known\nslug: known\ndate: 2026-10-21\ncategory: 个人杂谈\nstatus: published\ntags:\n  - 生活\n---\n\n';
  for(const [body,manifest,valid] of [
   ['`![[missing.webp]]`\n\n```md\n![[missing.webp]]\n```',{},true],
   ['An actual missing image ![[constructor]]',{},false],
   ['An actual missing image ![[toString]]',{},false],
   ['Article body.',{'bad.webp':'/../../private'},false],
   ['Article body.',{'bad.webp':123},false],
  ]){
   fs.writeFileSync(path.join(root,'content','media-manifest.json'),JSON.stringify(manifest));
   fs.writeFileSync(path.join(root,'content','posts','known.md'),header+body);
   const result=spawnSync(process.execPath,[path.resolve('scripts/validate-content.mjs')],{cwd:root,encoding:'utf8'});
   assert.equal(result.status,valid?0:1,result.stderr);
   if(!valid)assert.match(result.stderr,/missing media manifest|invalid public media path/);
  }
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
