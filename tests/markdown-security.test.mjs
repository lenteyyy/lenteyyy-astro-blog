import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {Marked,Renderer} from 'marked';
function load(){const source=fs.readFileSync('src/lib/markdown.ts','utf8').replace(/^import .*;\n/gm,'');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};vm.runInNewContext(code,{exports,URL,Marked,Renderer,mediaManifest:{},translateText:x=>x});return exports;}
test('article links reject executable schemes, external protocol-relative URLs and control characters',()=>{
 const {safeLinkUrl,renderMarkdown}=load();
 for(const href of ['javascript:alert(1)','data:text/html,attack','//evil.test','/\\evil.test','java\tscript:alert(1)'])assert.equal(safeLinkUrl(href),'');
 for(const source of ['[attack](javascript:alert%281%29)','[attack](jav&#x61;script:alert%281%29)','![attack](data:image/svg+xml,attack)','<img src=x onerror="alert(1)">','<script>alert(1)</script>']){
  const html=renderMarkdown(source);assert.doesNotMatch(html,/<script\b|<img\b[^>]*\bonerror\s*=|href="javascript:|src="data:/i);
 }
 assert.match(renderMarkdown('[safe](https://example.test)'),/rel="noopener noreferrer"/);
});
