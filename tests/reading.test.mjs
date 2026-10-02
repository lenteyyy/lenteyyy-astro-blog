import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeHighlights, removeHighlight, splitPercent } from '../src/lib/ielts/mock/reading-state.ts';

test('highlight offsets reject untrusted values and out-of-passage ranges', () => {
  assert.deepEqual(normalizeHighlights([null, {}, {start: -1, end: 2}, {start: 1.5, end: 3}, {start: 2, end: 20}, {start: 2, end: 2}, {start: 2, end: 5, html: '<script>'}], 10), [{start: 2, end: 5}]);
  assert.deepEqual(normalizeHighlights('<img onerror=alert(1)>', 10), []);
});
test('repeated and overlapping highlights merge without duplicates', () => {
  assert.deepEqual(normalizeHighlights([{start: 10, end: 20}, {start: 2, end: 12}, {start: 2, end: 12}, {start: 20, end: 21}], 30), [{start: 2, end: 21}]);
});
test('removal preserves text on either side of selected highlight', () => {
  assert.deepEqual(removeHighlight([{start: 2, end: 20}], {start: 5, end: 10}), [{start: 2, end: 5}, {start: 10, end: 20}]);
  assert.deepEqual(removeHighlight([{start: 2, end: 20}], {start: 0, end: 30}), []);
  assert.deepEqual(removeHighlight([{start: 2, end: 20}], {start: 25, end: 30}), [{start: 2, end: 20}]);
});
test('cross-paragraph offsets survive JSON roundtrip', () => {
  const ranges = [{start: 2, end: 100}];
  assert.deepEqual(normalizeHighlights(JSON.parse(JSON.stringify(ranges)), 150), ranges);
});
test('divider clamps both sides at 280 CSS pixels', () => {
  for (const width of [600, 768, 1024, 1366, 1920]) for (const request of [-999, 0, 30, 50, 70, 100, 999]) {
    const value = splitPercent(request, width);
    assert.ok(width * value / 100 >= 279.999);
    assert.ok(width * (100 - value) / 100 >= 279.999);
  }
});
test('divider safely handles narrow viewports, invalid storage and repeated drags', () => {
  assert.equal(splitPercent(NaN, 1000), 50);
  assert.equal(splitPercent('80', 1000), 50);
  assert.equal(splitPercent(90, 400), 50);
  let value = 50;
  for (let index = 0; index < 1000; index++) value = splitPercent(index % 2 ? -100 : 200, 800);
  assert.equal(value, 35);
});
test('question content retains all 40 reading/listening answers and section ranges', () => {
  const content = JSON.parse(readFileSync(new URL('../src/lib/ielts/mock/test1-content.json', import.meta.url), 'utf8'));
  for (const subject of ['listening', 'reading']) {
    assert.equal(content.answerKeys[subject].length, 40);
    assert.deepEqual(content.sections[subject].flatMap(({first, last}) => Array.from({length: last - first + 1}, (_, i) => first + i)), Array.from({length: 40}, (_, i) => i + 1));
  }
});
test('passage/highlight renderers do not execute saved HTML or make network requests', () => {
  const tools = readFileSync(new URL('../src/lib/ielts/mock/reading-tools.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(tools, /innerHTML|outerHTML|insertAdjacentHTML|\bfetch\(|\beval\(/);
  assert.match(tools, /passage\.contains\(range\.startContainer\)/);
  assert.match(tools, /passage\.contains\(range\.endContainer\)/);
  const source = readFileSync(new URL('../src/pages/ielts/mock/test-1.astro', import.meta.url), 'utf8');
  assert.match(source, /telemetry=\{false\}/);
  assert.match(source, /replace\(\/</);
  assert.doesNotMatch(source, /class="brand"|<strong>IELTS<\/strong>/);
});
