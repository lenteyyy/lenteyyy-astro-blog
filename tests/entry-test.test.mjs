import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { answerIds, cleanAnswers, exportAnswers, wordCount } from '../src/lib/ielts/entry-test/answers.ts';
const content = JSON.parse(readFileSync(new URL('../src/lib/ielts/entry-test/content.json', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../src/pages/ielts/entry-test.astro', import.meta.url), 'utf8');

test('entry test contains 10 listening, 14 reading, 10 writing choices and two essays in source order', () => {
  const questions = g => g.flatMap(x => x.questions);
  assert.deepEqual(questions(content.listening.groups).map(q => q.number), Array.from({ length: 10 }, (_, i) => i + 1));
  assert.deepEqual(questions(content.reading.groups).map(q => q.number), Array.from({ length: 14 }, (_, i) => i + 1));
  assert.equal(content.reading.paragraphs.length, 6);
  assert.deepEqual(content.reading.paragraphs.map(p => p[0]), ['A', 'B', 'C', 'D', 'E', 'F']);
  for (const task of content.writing.tasks) assert.deepEqual(questions(task.groups).map(q => q.number), [1, 2, 3, 4, 5]);
  assert.equal(answerIds(content).length, 37);
  assert.equal(new Set(answerIds(content)).size, 37);
  assert.ok(existsSync(new URL('../public' + content.writing.tasks[0].image, import.meta.url)));
});
test('student content excludes reference keys, transcript and timer', () => {
  assert.doesNotMatch(JSON.stringify(content), /Listening Script|Reference Answers|answerKey|answerKeys|Good afternoon, everyone\. Today/);
  assert.doesNotMatch(source, /data-clock|deadline|setInterval|answerKey|data-submit|score/);
  assert.match(source, /import\.meta\.env\.DEV &&/);
  assert.match(source, /getAuthContext\(Astro\.cookies\)/);
  assert.match(source, /private, no-store/);
  assert.match(source, /telemetry=\{false\}/);
});
test('export includes every student answer, empty answers, both essays and notes, not account data', () => {
  const values = Object.fromEntries(answerIds(content).map(id => [id, `answer-${id}`]));
  values.accountId = 'private-account'; values.email = 'private@example.test'; values.answerKey = 'PRIVATE';
  const result = exportAnswers(content, values);
  for (const id of answerIds(content)) assert.ok(result.includes(`answer-${id}`));
  assert.ok(result.indexOf(content.listening.title) < result.indexOf(content.reading.title));
  assert.ok(result.indexOf(content.reading.title) < result.indexOf(content.writing.title));
  assert.doesNotMatch(result, /private-account|private@example|PRIVATE/);
  assert.match(exportAnswers(content, null), /未作答/);
});
test('untrusted storage rejects extra fields, arrays and oversize values; export is plain UTF-8 text', () => {
  assert.deepEqual(cleanAnswers(null, answerIds(content)), {});
  assert.deepEqual(cleanAnswers(['malicious'], answerIds(content)), {});
  const value = JSON.parse('{"__proto__":{"polluted":true},"L1":"<img onerror=alert(1)>\\u0000","W1":123,"L2":"=HYPERLINK(1)","private":"secret"}');
  const clean = cleanAnswers(value, answerIds(content));
  assert.equal(Object.prototype.polluted, undefined);
  assert.deepEqual(Object.keys(clean), ['L1', 'L2']);
  assert.doesNotMatch(exportAnswers(content, value), /\u0000|secret/);
  assert.ok(exportAnswers(content, value).includes('<img onerror=alert(1)>'));
  assert.equal(cleanAnswers({ W1: 'a'.repeat(60000), L1: 'b'.repeat(1000) }, answerIds(content)).W1.length, 50000);
  assert.equal(cleanAnswers({ L1: 'b'.repeat(1000) }, answerIds(content)).L1.length, 200);
  assert.equal(wordCount('An essay, with twenty-one words?'), 5);
});
test('answers are rendered as form values and exported locally, never HTML or network uploads', () => {
  assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML|fetch\(|XMLHttpRequest|sendBeacon|import\.meta\.env\.PUBLIC_/);
  assert.match(source, /text\/plain;charset=utf-8/);
  assert.match(source, /URL\.revokeObjectURL/);
  assert.match(source, /replace\(\/</);
  assert.match(source, /data-highlight-add="yellow"/);
  assert.match(source, /data-highlight-add="blue"/);
  assert.match(source, /lenteyyy-entry-test-v1-\$\{data\.accountId\}/);
  const home = readFileSync(new URL('../src/pages/ielts/index.astro', import.meta.url), 'utf8');
  assert.match(home, /href="\/ielts\/entry-test"/);
});
