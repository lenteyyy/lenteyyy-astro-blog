import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { answerIds, cleanAnswers, exportAnswers, inlineAnswerParts } from '../src/lib/ielts/entry-test/answers.ts';
const content = JSON.parse(readFileSync(new URL('../src/lib/ielts/entry-test/content.json', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../src/pages/ielts/entry-test.astro', import.meta.url), 'utf8');

test('entry test contains 10 listening, 14 reading and 10 writing choices in source order', () => {
  const questions = g => g.flatMap(x => x.questions);
  assert.deepEqual(questions(content.listening.groups).map(q => q.number), Array.from({ length: 10 }, (_, i) => i + 1));
  assert.deepEqual(questions(content.reading.groups).map(q => q.number), Array.from({ length: 14 }, (_, i) => i + 1));
  assert.equal(content.reading.paragraphs.length, 6);
  assert.deepEqual(content.reading.paragraphs.map(p => p[0]), ['A', 'B', 'C', 'D', 'E', 'F']);
  for (const task of content.writing.tasks) assert.deepEqual(questions(task.groups).map(q => q.number), [1, 2, 3, 4, 5]);
  assert.equal(answerIds(content).length, 34);
  assert.equal(new Set(answerIds(content)).size, 34);
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
test('export includes every student choice, not account data, old essays or deleted notes', () => {
  const values = Object.fromEntries(answerIds(content).map(id => [id, `answer-${id}`]));
  values.accountId = 'private-account'; values.email = 'private@example.test'; values.answerKey = 'PRIVATE';
  values.notes = 'deleted-private-notes';
  values.W1 = 'deleted-private-essay-one'; values.W2 = 'deleted-private-essay-two';
  const result = exportAnswers(content, values);
  for (const id of answerIds(content)) assert.ok(result.includes(`answer-${id}`));
  assert.ok(result.indexOf(content.listening.title) < result.indexOf(content.reading.title));
  assert.ok(result.indexOf(content.reading.title) < result.indexOf(content.writing.title));
  assert.doesNotMatch(result, /private-account|private@example|PRIVATE|deleted-private-notes|deleted-private-essay|想讨论的问题|作文|字数/);
  assert.doesNotMatch(source, /<textarea|data-word-count|writing-diagnostic|minimumWords|完整作文/);
  assert.match(exportAnswers(content, null), /未作答/);
});
test('choice stems containing blanks stay intact and their choices never enter the sentence', () => {
  for (const task of content.writing.tasks) {
    const question = task.groups.flatMap(group => group.questions).find(q => q.number === 5);
    assert.ok(question.prompt.includes('____'));
    assert.ok(question.prompt.includes(task.id === 'W1' ? 'exceeding the 24 million units' : 'the very freedoms that such systems claim to protect'));
    assert.equal(inlineAnswerParts(question), undefined);
  }
  assert.deepEqual(inlineAnswerParts(content.listening.groups[0].questions[0]), {
    before: "Fenwick's solar panel scheme was funded through a regional ", after: '.',
  });
  const base = { id: 'test', number: 1, options: [], choices: [] };
  assert.equal(inlineAnswerParts({ ...base, prompt: 'First ____ and second ____.' }), undefined);
  assert.equal(inlineAnswerParts({ ...base, prompt: 'No gap.' }), undefined);
  assert.deepEqual(inlineAnswerParts({ ...base, prompt: 'A (1) ____ with its full ending.' }), { before: 'A ', after: ' with its full ending.' });
});
test('two-digit question numbers stay on one horizontal line at every font size', () => {
  assert.match(source, /grid-template-columns: 2\.5ch minmax\(0, 1fr\)/);
  assert.match(source, /\.question-prompt strong \{[^}]*white-space: nowrap;[^}]*overflow-wrap: normal;[^}]*word-break: normal;[^}]*font-variant-numeric: tabular-nums;/);
  assert.match(source, /padding-left: calc\(2\.5ch \+ 10px\)/);
});
test('listening audio is present without identifying ID3 tags; gap controls and radio choices are inline', () => {
  const audio = readFileSync(new URL('../public' + content.listening.audio, import.meta.url));
  assert.ok(audio.length > 100000);
  assert.notEqual(audio.subarray(0, 3).toString(), 'ID3');
  assert.notEqual(audio.subarray(-128, -125).toString(), 'TAG');
  assert.match(source, /<audio controls preload="metadata"/);
  const questions = readFileSync(new URL('../src/components/ielts/EntryQuestions.astro', import.meta.url), 'utf8');
  const controls = readFileSync(new URL('../src/components/ielts/EntryAnswer.astro', import.meta.url), 'utf8');
  assert.match(questions, /prefix=\{prefix\} inline/);
  assert.match(controls, /type="radio"/);
  assert.match(source, /control\.checked = answer === control\.value/);
  assert.doesNotMatch(source + JSON.stringify(content), /做题前|想讨论的问题|听力由老师播放或朗读|不自动上传|拿不准可以留空|先做选择题/);
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
  assert.equal(cleanAnswers({ W1: 'a'.repeat(60000), L1: 'b'.repeat(1000) }, answerIds(content)).W1, undefined);
  assert.equal(cleanAnswers({ L1: 'b'.repeat(1000) }, answerIds(content)).L1.length, 200);
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
test('formal entry workspace highlights stems and passages in every subject without touching controls', () => {
  assert.match(source, /data-highlight-region=\{subject\}/);
  assert.match(source, /data-highlight-region=\{`\$\{subject\}-questions`\}/);
  assert.match(source, /setupTextHighlights\(root/);
  assert.match(source, /highlight: false/);
  assert.match(source, /'listening-questions', 'reading-questions', 'writing-questions'/);
  assert.match(source, /textTools\.render\(\)/);
  const questions = readFileSync(new URL('../src/components/ielts/EntryQuestions.astro', import.meta.url), 'utf8');
  assert.match(questions, /<strong data-no-highlight>/);
  const highlights = readFileSync(new URL('../src/lib/ielts/mock/text-highlights.ts', import.meta.url), 'utf8');
  assert.match(highlights, /input,select,textarea,button,a,audio/);
  assert.match(highlights, /range\.intersectsNode\(el\)/);
  assert.match(highlights, /mark\.textContent=/);
  assert.doesNotMatch(highlights, /innerHTML|insertAdjacentHTML/);
});
