import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { examFontSize, normalizeHighlights, removeHighlight, splitPercent } from '../src/lib/ielts/mock/reading-state.ts';

test('highlight offsets reject untrusted values and out-of-passage ranges', () => {
  assert.deepEqual(normalizeHighlights([null, {}, {start: -1, end: 2}, {start: 1.5, end: 3}, {start: 2, end: 20}, {start: 2, end: 2}, {start: 2, end: 5, html: '<script>'}], 10), [{start: 2, end: 5, color: 'yellow'}]);
  assert.deepEqual(normalizeHighlights('<img onerror=alert(1)>', 10), []);
});
test('repeated and overlapping highlights merge without duplicates', () => {
  assert.deepEqual(normalizeHighlights([{start: 10, end: 20}, {start: 2, end: 12}, {start: 2, end: 12}, {start: 20, end: 21}], 30), [{start: 2, end: 21, color: 'yellow'}]);
});
test('removal preserves text on either side of selected highlight', () => {
  assert.deepEqual(removeHighlight([{start: 2, end: 20}], {start: 5, end: 10}), [{start: 2, end: 5}, {start: 10, end: 20}]);
  assert.deepEqual(removeHighlight([{start: 2, end: 20}], {start: 0, end: 30}), []);
  assert.deepEqual(removeHighlight([{start: 2, end: 20}], {start: 25, end: 30}), [{start: 2, end: 20}]);
});
test('cross-paragraph offsets survive JSON roundtrip', () => {
  const ranges = [{start: 2, end: 100, color: 'blue'}];
  assert.deepEqual(normalizeHighlights(JSON.parse(JSON.stringify(ranges)), 150), ranges);
});
test('two colours repaint overlaps without losing surrounding highlights', () => {
  const ranges = normalizeHighlights([{start: 2, end: 20}, {start: 5, end: 10, color: 'blue'}], 30);
  assert.deepEqual(ranges, [{start: 2, end: 5, color: 'yellow'}, {start: 5, end: 10, color: 'blue'}, {start: 10, end: 20, color: 'yellow'}]);
  assert.deepEqual(normalizeHighlights([...ranges, {start: 2, end: 20, color: 'blue'}], 30), [{start: 2, end: 20, color: 'blue'}]);
  assert.deepEqual(removeHighlight(ranges, {start: 4, end: 12}), [{start: 2, end: 4, color: 'yellow'}, {start: 12, end: 20, color: 'yellow'}]);
  assert.deepEqual(normalizeHighlights([{start: 0, end: 2, color: 'url(javascript:alert(1))'}], 3), [{start: 0, end: 2, color: 'yellow'}]);
});
test('repeated recolouring produces sorted, disjoint, persistent text offsets', () => {
  let ranges = [];
  const expected = Array(100).fill(null);
  for (let i = 0; i < 80; i++) {
    const start = (i * 17) % 80; const end = start + 20; const color = i % 2 ? 'blue' : 'yellow';
    ranges = normalizeHighlights([...ranges, {start, end, color}], 100);
    expected.fill(color, start, end);
    const actual = Array(100).fill(null);
    for (const range of ranges) actual.fill(range.color, range.start, range.end);
    assert.deepEqual(actual, expected);
    assert.deepEqual(normalizeHighlights(JSON.parse(JSON.stringify(ranges)), 100), ranges);
    for (let j = 1; j < ranges.length; j++) assert.ok(ranges[j].start >= ranges[j-1].end);
  }
});
test('font size allows only readable fixed values, never arbitrary stored CSS', () => {
  for (const value of [null, undefined, NaN, Infinity, '20', '20px; color:red', 0, -1, 100]) assert.equal(examFontSize(value), 16);
  for (const value of [16, 18, 20]) assert.equal(examFontSize(value), value);
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
  const source = readFileSync(new URL('../src/components/ielts/MockExam.astro', import.meta.url), 'utf8');
  assert.match(source, /telemetry=\{false\}/);
  assert.match(source, /replace\(\/</);
  assert.doesNotMatch(source, /class="brand"|<strong>IELTS<\/strong>/);
});
