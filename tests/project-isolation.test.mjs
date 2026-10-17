import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {assertTarget,assertRemoteIdentity,blogTarget} from '../scripts/verify-deployment-target.mjs';
import {verifyProjectIsolation} from '../scripts/verify-project-isolation.mjs';

test('deployment guard rejects a different Vercel account, team, project, Git repository or production branch',()=>{
 const link={projectId:blogTarget.projectId,orgId:blogTarget.teamId,projectName:blogTarget.projectName};const remote='https://github.com/lenteyyy/lenteyyy-astro-blog.git';
 assert.doesNotThrow(()=>assertTarget(link,remote));
 assert.throws(()=>assertTarget({...link,projectId:'another-project'},remote));
 assert.throws(()=>assertTarget({...link,orgId:'another-team'},remote));
 assert.throws(()=>assertTarget(link,'https://github.com/lenteyyy/lenteyielts.git'));
 const user={email:'blog-owner@example.test',team:{id:blogTarget.teamId}};
 const project={id:blogTarget.projectId,accountId:blogTarget.teamId,name:blogTarget.projectName,link:{org:'lenteyyy',repo:'lenteyyy-astro-blog',repoId:1296448006,productionBranch:'main'}};
 assert.doesNotThrow(()=>assertRemoteIdentity(user,project,user.email));
 assert.throws(()=>assertRemoteIdentity(user,project,'wrong@example.test'));
 assert.throws(()=>assertRemoteIdentity(user,{...project,link:{...project.link,repo:'lenteyielts'}},user.email));
 assert.throws(()=>assertRemoteIdentity(user,{...project,link:{...project.link,productionBranch:'unreviewed'}},user.email));
});

test('runtime isolation rejects foreign public scripts, leaked private files and symlinked assets',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'blog-isolation-'));
 try{
  fs.writeFileSync(path.join(root,'vercel.json'),JSON.stringify({git:{deploymentEnabled:false}}));
  for(const dir of ['src','public','dist/client'])fs.mkdirSync(path.join(root,dir),{recursive:true});
  assert.doesNotThrow(()=>verifyProjectIsolation(root));
  for(const [file,content] of [['public/legacy.js','fetch("https://lenteyielts.cn/api/ielts/me")'],['public/assets/ielts-score-report.jpg','private image'],['dist/client/.env.production','private'],['dist/client/ielts/index.html','old route']]){
   const full=path.join(root,file);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,content);assert.throws(()=>verifyProjectIsolation(root));fs.rmSync(full);
  }
  fs.symlinkSync(path.join(root,'src'),path.join(root,'public','outside'));assert.throws(()=>verifyProjectIsolation(root));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('only an explicit outbound learning-site anchor is allowed, not a shared runtime',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'blog-outbound-link-'));
 try{
  fs.writeFileSync(path.join(root,'vercel.json'),JSON.stringify({git:{deploymentEnabled:false}}));
  for(const dir of ['src','public','dist/client'])fs.mkdirSync(path.join(root,dir),{recursive:true});
  const safe='<a href="https://lenteyielts.cn/" target="_blank" rel="noopener noreferrer">冷踢踢的雅思学习网站</a>';
  fs.writeFileSync(path.join(root,'src','layout.astro'),safe);
  fs.writeFileSync(path.join(root,'dist/client','index.html'),safe);
  assert.doesNotThrow(()=>verifyProjectIsolation(root));
  for(const markup of [
   '<iframe src="https://lenteyielts.cn/"></iframe>',
   '<a href="https://lenteyielts.cn/api/ielts/me">account</a>',
   '<a data-href="https://lenteyielts.cn/">not an href</a>',
   '<a title=\' href="https://lenteyielts.cn/"\'>quoted attribute</a>',
   '<div title=\'<a href="https://lenteyielts.cn/">\'>not an anchor</div>',
   '<a href="https://lenteyielts.cn/" data-endpoint="https://lenteyielts.cn/">bridge</a>',
   safe+'<script>fetch("https://lenteyielts.cn/")</script>',
   '<script>const html='+JSON.stringify(safe)+'</script>',
  ]){
   fs.writeFileSync(path.join(root,'dist/client','index.html'),markup);
   assert.throws(()=>verifyProjectIsolation(root));
  }
  fs.writeFileSync(path.join(root,'dist/client','index.html'),safe);
  fs.writeFileSync(path.join(root,'public','bridge.js'),'const html='+JSON.stringify(safe));
  assert.throws(()=>verifyProjectIsolation(root));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
