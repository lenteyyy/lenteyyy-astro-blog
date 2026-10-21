import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';

test('media synchronization preserves existing output on missing/corrupt inputs or manifest commit failure',async()=>{
 const image=await sharp({create:{width:8,height:8,channels:3,background:'#f8f5ef'}}).png().toBuffer();
 for(const scenario of ['missing','corrupt','manifest-failure','success']){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'blog-media-sync-'));
  try {
   for(const folder of ['content/posts','content/_attachments','public/media'])fs.mkdirSync(path.join(root,folder),{recursive:true});
   const oldManifest=JSON.stringify({'old.png':'/media/old.webp'}),manifest=path.join(root,'content/media-manifest.json');
   if(scenario==='manifest-failure')fs.mkdirSync(manifest);else fs.writeFileSync(manifest,oldManifest);
   fs.writeFileSync(path.join(root,'public/media/old.webp'),'unchanged existing media');
   fs.writeFileSync(path.join(root,'content/_attachments/a-valid.png'),image);
   fs.writeFileSync(path.join(root,'content/_attachments/z-corrupt.png'),'not an image');
   const extra=scenario==='missing'?'\n\n![[missing.png]]':scenario==='corrupt'?'\n\n![[z-corrupt.png]]':'';
   fs.writeFileSync(path.join(root,'content/posts/known.md'),'Article\n\n![[a-valid.png]]'+extra);
   const result=spawnSync(process.execPath,[path.resolve('scripts/sync-media.mjs')],{cwd:root,encoding:'utf8'});
   if(scenario==='success'){
    assert.equal(result.status,0,result.stderr);
    assert.equal(fs.existsSync(path.join(root,'public/media/old.webp')),false);
    const next=JSON.parse(fs.readFileSync(manifest,'utf8'));
    assert.match(next['a-valid.png'],/^\/media\/[a-f0-9]{20}\.webp$/);
    const metadata=await sharp(path.join(root,'public',next['a-valid.png'])).metadata();
    assert.equal(metadata.width,8);assert.equal(metadata.exif,undefined);
   } else {
    assert.notEqual(result.status,0);
    assert.equal(fs.readFileSync(path.join(root,'public/media/old.webp'),'utf8'),'unchanged existing media');
    if(scenario!=='manifest-failure')assert.equal(fs.readFileSync(manifest,'utf8'),oldManifest);
   }
   assert.deepEqual(fs.readdirSync(path.join(root,'.astro')),[]);
  } finally {fs.rmSync(root,{recursive:true,force:true});}
 }
});
