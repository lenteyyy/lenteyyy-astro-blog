import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('external theme initialization preserves explicit session choice after page swaps',()=>{
 let stored='dark',listener;const root={dataset:{},removeAttribute(name){assert.equal(name,'data-theme');delete this.dataset.theme;}};let removed;
 vm.runInNewContext(fs.readFileSync('public/theme-init.js','utf8'),{localStorage:{removeItem:key=>removed=key},sessionStorage:{getItem:()=>stored},document:{documentElement:root,addEventListener:(event,fn)=>{assert.equal(event,'astro:after-swap');listener=fn;}}});
 assert.equal(removed,'theme');assert.equal(root.dataset.theme,'dark');
 root.dataset={};listener();assert.equal(root.dataset.theme,'dark');stored='light';listener();assert.equal(root.dataset.theme,'light');stored='invalid';listener();assert.equal(root.dataset.theme,undefined);
});
