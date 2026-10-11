import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTypingText, typingDuration, typingStats, typingClock } from '../src/lib/ielts/typing.ts';

test('typing durations accept only supported options', () => {
	for (const value of [30, '60', 120]) assert.equal(typingDuration(value), Number(value));
	for (const value of [-30, 0, 1, 999, Infinity, undefined, 'bad']) assert.equal(typingDuration(value), 60);
});
test('practice banks produce sufficient English text and both modes differ', () => {
	for (const mode of ['words', 'passage']) {
		const text = createTypingText(mode, () => .5);
		assert.ok(text.length >= 2400 && text.length < 3600);
		assert.match(text, /^[A-Za-z ,.]+$/);
		assert.equal(text, createTypingText(mode, () => .5));
	}
	assert.doesNotMatch(createTypingText('words'), /[A-Z.]/);
	assert.match(createTypingText('passage'), /[A-Z].*\./);
});
test('WPM counts five correct characters including spaces per word', () => {
	assert.deepEqual(typingStats('hello world', 'hello world', 60000), { typed: 11, correct: 11, errors: 0, accuracy: 100, wpm: 2, cpm: 11, progress: 100 });
	assert.equal(typingStats('abcdefghijklmnopqrst', 'abcdefghijklmnopqrst', 30000).wpm, 8);
});
test('mistakes, correction, case and overlong input are measured consistently', () => {
	assert.equal(typingStats('hello', 'hallo', 60000).accuracy, 80);
	assert.equal(typingStats('hello', 'hallo', 60000).errors, 1);
	assert.equal(typingStats('hello', 'hello', 60000).errors, 0);
	assert.equal(typingStats('hello', 'Hello', 60000).accuracy, 80);
	assert.equal(typingStats('hello', 'hello extra', 60000).typed, 5);
});
test('idle and invalid elapsed time never produce infinite speed', () => {
	for (const time of [0, -1, Infinity, NaN]) assert.equal(typingStats('abc', 'abc', time).wpm, 0);
	assert.equal(typingStats('', '', 60000).progress, 0);
	assert.equal(typingStats('abc', '', 60000).accuracy, 100);
});
test('absolute clock expires at deadline even after background timer throttling', () => {
	assert.deepEqual(typingClock(1000, 1000, 30), { elapsed: 0, remaining: 30, expired: false });
	assert.deepEqual(typingClock(1000, 30999, 30), { elapsed: 29999, remaining: 1, expired: false });
	assert.deepEqual(typingClock(1000, 31000, 30), { elapsed: 30000, remaining: 0, expired: true });
	assert.deepEqual(typingClock(1000, 999999, 30), { elapsed: 30000, remaining: 0, expired: true });
});
test('typing tool has no upload, persistence, remote dependencies or unsafe HTML', () => {
	const client = readFileSync(new URL('../src/lib/ielts/typing-client.ts', import.meta.url), 'utf8');
	const page = readFileSync(new URL('../src/pages/ielts/typing.astro', import.meta.url), 'utf8');
	assert.doesNotMatch(client, /fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB|innerHTML|outerHTML|eval\(/);
	assert.match(client, /span\.textContent = character/);
	assert.match(client, /\['paste', 'drop'\]/);
	assert.match(client, /visibilitychange/);
	assert.match(page, /telemetry=\{false\}/);
	assert.match(page, /animation: none/);
	assert.doesNotMatch(page, /https?:\/\//);
});
