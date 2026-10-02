import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as state from '../src/lib/ielts/mock/reading-state.ts';

test('mouse, touch and pen drags share bounds, release capture and handle cancellation', () => {
  const source = readFileSync(new URL('../src/lib/ielts/mock/reading-tools.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const listeners = new Map(); const attributes = new Map(); const styles = new Map(); const captured = new Set(); const classes = new Set();
  const target = (name) => ({
    addEventListener(event, handler) { listeners.set(`${name}:${event}`, handler); },
    setAttribute(key, value) { attributes.set(key, value); },
    contains() { return false; },
  });
  const divider = {...target('divider'), offsetWidth: 14,
    setPointerCapture(id) { captured.add(id); },
    hasPointerCapture(id) { return captured.has(id); },
    releasePointerCapture(id) { captured.delete(id); },
  };
  const workspace = {clientWidth: 1000, getBoundingClientRect: () => ({left: 0}), style: {setProperty(key, value) {styles.set(key, value);}}};
  const add = target('add'); const remove = target('remove');
  const tools = {...target('tools'), querySelector: (selector) => selector.includes('-add') ? add : remove};
  const passage = target('passage');
  const root = {
    querySelector: (selector) => selector === '.reading-workspace' ? workspace : selector === '[data-divider]' ? divider : selector === '[data-passage]' ? passage : tools,
    querySelectorAll: () => [],
    classList: {add(name) {classes.add(name);}, remove(name) {classes.delete(name);}},
  };
  const exports = {}; let saved = 50;
  vm.runInNewContext(code, {
    exports, require: () => state,
    window: {...target('window'), matchMedia: () => ({matches: false}), getSelection: () => ({removeAllRanges() {}})},
    document: target('document'),
    ResizeObserver: class {observe() {}},
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
  });
  exports.setupReadingTools(root, {getSplit: () => saved, setSplit: (value) => {saved = value;}, getHighlights: () => [], setHighlights() {}});
  for (const pointerType of ['mouse', 'touch', 'pen']) {
    for (let index = 0; index < 10; index++) {
      listeners.get('divider:pointerdown')({button: 0, pointerId: 7, pointerType, preventDefault() {}});
      assert.equal(captured.has(7), true);
      listeners.get('divider:pointermove')({pointerId: 7, pointerType, clientX: index % 2 ? -100 : 2000});
      listeners.get(index % 2 ? 'divider:pointercancel' : 'divider:pointerup')({pointerId: 7});
      assert.equal(captured.size, 0);
      assert.equal(classes.has('resizing'), false);
      assert.ok(saved * 966 / 100 >= 279.999);
      assert.ok((100 - saved) * 966 / 100 >= 279.999);
    }
  }
  listeners.get('divider:keydown')({key: 'Home', preventDefault() {}});
  assert.ok(Math.abs(saved * 966 / 100 - 280) < 0.001);
  listeners.get('divider:keydown')({key: 'End', preventDefault() {}});
  assert.ok(Math.abs((100 - saved) * 966 / 100 - 280) < 0.001);
});
