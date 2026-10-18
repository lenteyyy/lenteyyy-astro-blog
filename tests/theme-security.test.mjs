import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('external theme initialization preserves explicit session choice after page swaps',()=>{
 let stored='dark',listener;const root={dataset:{},removeAttribute(name){assert.equal(name,'data-theme');delete this.dataset.theme;}};let removed;
 vm.runInNewContext(fs.readFileSync('public/theme-init.js','utf8'),{localStorage:{removeItem:key=>removed=key},sessionStorage:{getItem:()=>stored},document:{documentElement:root,addEventListener:(event,fn)=>{if(event==='astro:after-swap')listener=fn;}}});
 assert.equal(removed,'theme');assert.equal(root.dataset.theme,'dark');
 root.dataset={};listener();assert.equal(root.dataset.theme,'dark');stored='light';listener();assert.equal(root.dataset.theme,'light');stored='invalid';listener();assert.equal(root.dataset.theme,undefined);
});

test('blocked local or session storage cannot break theme initialization or page swaps',()=>{
 const source=fs.readFileSync('public/theme-init.js','utf8');
 for(const blocked of ['local','session','both']) {
  const listeners={};const root={dataset:{theme:'dark'},removeAttribute(){delete this.dataset.theme;}};
  const storage={getItem:()=> 'light'};
  const scope={document:{documentElement:root,addEventListener:(event,fn)=>listeners[event]=fn},localStorage:{removeItem(){}},sessionStorage:storage};
  if(blocked==='local'||blocked==='both')Object.defineProperty(scope,'localStorage',{get(){throw Error('denied');}});
  if(blocked==='session'||blocked==='both')Object.defineProperty(scope,'sessionStorage',{get(){throw Error('denied');}});
  assert.doesNotThrow(()=>vm.runInNewContext(source,scope));assert.equal(typeof listeners['astro:after-swap'],'function');assert.doesNotThrow(()=>listeners['astro:after-swap']());
  assert.equal(root.dataset.theme,blocked==='local'?'light':'dark');
  root.dataset.theme='dark';listeners['astro:before-swap']();root.dataset={};listeners['astro:after-swap']();
  assert.equal(root.dataset.theme,blocked==='local'?'light':'dark');
 }
});
