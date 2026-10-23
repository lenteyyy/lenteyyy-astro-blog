import test from 'node:test';
import assert from 'node:assert/strict';
import { jsx } from '../node_modules/astro/dist/jsx-runtime/index.js';
import { renderJSX } from '../node_modules/astro/dist/runtime/server/jsx.js';
import { stringifyAnimation } from '../node_modules/astro/dist/runtime/server/transition.js';

test('patched Astro JSX rendering cannot terminate dynamic script or style children',async()=>{
 for(const tag of ['script','style']) {
  const payload=`</${tag}><img src=x onerror=alert(1)><${tag}>`;
  const html=String(await renderJSX({pathname:'/security-test'},jsx(tag,{children:payload})));
  assert.equal((html.match(new RegExp(`</${tag}>`,'g'))||[]).length,1);
  assert.doesNotMatch(html,/<img\b/);
 }
});

test('patched Astro transition values cannot escape their generated CSS declaration',()=>{
 const html=stringifyAnimation({name:'fade',duration:'200ms; } .audit-injected { color: red',easing:'ease; } body { display: none'});
 assert.doesNotMatch(html,/200ms;\s*\}|ease;\s*\}/);
 assert.match(html,/\\3B /);assert.match(html,/\\7B /);assert.match(html,/\\7D /);
 assert.ok(stringifyAnimation({name:'fade',duration:'180ms'}).includes('180ms'));
});
