import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {Marked,Renderer} from 'marked';
function load(manifest={}){const source=fs.readFileSync('src/lib/markdown.ts','utf8').replace(/^import .*;\n/gm,'');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};vm.runInNewContext(code,{exports,URL,Marked,Renderer,mediaManifest:manifest,translateText:x=>x});return exports;}
test('article links reject executable schemes, external protocol-relative URLs and control characters',()=>{
 const {safeLinkUrl,renderMarkdown}=load();
 for(const href of ['javascript:alert(1)','data:text/html,attack','//evil.test','/\\evil.test','java\tscript:alert(1)','https://user:password@example.test/'])assert.equal(safeLinkUrl(href),'');
 for(const source of ['[attack](javascript:alert%281%29)','[attack](jav&#x61;script:alert%281%29)','![attack](data:image/svg+xml,attack)','<img src=x onerror="alert(1)">','<script>alert(1)</script>']){
  const html=renderMarkdown(source);assert.doesNotMatch(html,/<script\b|<img\b[^>]*\bonerror\s*=|href="javascript:|src="data:/i);
 }
 assert.match(renderMarkdown('[safe](https://example.test)'),/rel="noopener noreferrer"/);
});

test('media references never resolve inherited object properties',()=>{
 const {resolveMediaReference,renderMarkdown}=load();
 for(const ref of ['__proto__','constructor','toString','hasOwnProperty']){
  assert.equal(resolveMediaReference(`![[${ref}]]`),'');assert.doesNotMatch(renderMarkdown(`![[${ref}]]`),/<img\b/);
 }
});

test('adversarial Markdown cannot emit executable tags, event handlers or credentialed links',()=>{
 const {renderMarkdown}=load();
 const payloads=[
  '<svg><script>alert(1)</script></svg>',
  '<math><mtext><img src=x onerror=alert(1)></mtext></math>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '[x](https://user:private@example.test/path)',
  '[x](jav&#x61;script:alert%281%29)',
  '[x](java&#x09;script:alert%281%29)',
  '<a href="javascript:alert(1)">x</a>',
  '![x" onload="alert(1)](https://example.test/image.png)',
  '[x](https://example.test "onmouseover=alert(1)")',
  '```html\n<script>alert(1)</script>\n```',
 ];
 for(const source of payloads)for(const locale of ['zh-CN','zh-TW']){
  const html=renderMarkdown(source,locale);
  assert.doesNotMatch(html,/<(?:script|iframe|svg|math|object|embed)\b|<[a-z][^>]*\son[a-z]+\s*=(?![^<]*&quot;)/i);
  assert.doesNotMatch(html,/(?:href|src)="(?:javascript:|data:|https:\/\/user:)/i);
 }
});

test('TOC uses actual rendered headings, including duplicates and links, not fenced code',()=>{
 const {renderMarkdown,getMarkdownHeadings}=load();
 const source='## [Linked title](https://example.test)\n\n```md\n## Fake heading\n```\n\nSetext heading\n---\n\n## Linked title\n\n> ### Nested heading\n';
 const html=renderMarkdown(source);
 const headings=getMarkdownHeadings(source);
 assert.deepEqual(JSON.parse(JSON.stringify(headings)).map(h=>h.text),['Linked title','Setext heading','Linked title','Nested heading']);
 assert.deepEqual(JSON.parse(JSON.stringify(headings)).map(h=>h.id),['linked-title','setext-heading','linked-title-2','nested-heading']);
 for(const heading of headings) assert.ok(html.includes(`id="${heading.id}"`));
});

test('heading IDs cannot collide with suffixed headings or shared layout IDs',()=>{
 const {renderMarkdown,getMarkdownHeadings}=load();
 const source='## A\n\n## A\n\n## A-2\n\n## A\n\n## Language menu\n\n## Easter egg title\n\n## Wechat contact';
 const headings=getMarkdownHeadings(source),ids=headings.map(x=>x.id);
 assert.equal(new Set(ids).size,ids.length);
 for(const id of ['language-menu','easter-egg-title','wechat-contact']) assert.ok(!ids.includes(id));
 for(const id of ids) assert.ok(renderMarkdown(source).includes(`id="${id}"`));
});

test('wiki image parsing preserves code literals and escapes real captions',()=>{
 const {renderMarkdown}=load({'photo.webp':'/media/12345678901234567890.webp'});
 for(const ref of ['missing.webp','photo.webp']){
  const literal=`![[${ref}]]`;
  assert.ok(renderMarkdown('`'+literal+'`').includes(`<code>${literal}</code>`));
  assert.ok(renderMarkdown('```md\n'+literal+'\n```').includes(`>${literal}</code>`));
  assert.ok(!renderMarkdown('\\'+literal).includes('<img'));
 }
 assert.match(renderMarkdown('![[photo.webp|caption <script>]]'),/<img src="\/media\/12345678901234567890.webp"/);
 assert.doesNotMatch(renderMarkdown('![[photo.webp|caption <script>]]'),/<script>/);
});
