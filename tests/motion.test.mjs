import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file) {
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});return exports;
}
test('image expansion uses finite transform-only geometry and rejects unloaded images',()=>{
 const {imageMorphTransform}=load('src/lib/image-morph.ts');
 const from={left:10,top:20,width:100,height:150},to={left:40,top:50,width:400,height:600};
 assert.equal(imageMorphTransform(from,to),'translate(-30px, -30px) scale(0.25, 0.25)');
 for(const invalid of [{...from,width:0},{...from,top:NaN},{...from,height:Infinity},{...from,width:-1}])assert.equal(imageMorphTransform(invalid,to),undefined);
 assert.equal(imageMorphTransform(from,{...to,height:0}),undefined);
});
test('contained portrait images expand from visible pixels rather than letterboxed element bounds',()=>{
 const {containedImageBox}=load('src/lib/image-morph.ts');
 const result=containedImageBox({left:100,top:50,width:800,height:600},300,600);
 assert.deepEqual(JSON.parse(JSON.stringify(result)),{left:350,top:50,width:300,height:600});
});
test('motion policy keeps short bounded feedback and does not animate article reading',()=>{
 const {MOTION}=load('src/lib/motion-policy.ts');
 assert.equal(MOTION.revealDuration,480);assert.equal(MOTION.imageDialogDuration,320);
 const source=fs.readFileSync('src/lib/site-motion.ts','utf8');
 assert.match(source,/document\.querySelector\('\.intro'\)/);
 assert.doesNotMatch(source,/\.article-body|\.article-content|\.post-header|\.hero-image|\.post-nav/);
 assert.match(source,/:not\(:first-child\)/);
});
