import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDictation, randomIndex, normalizeDictation } from '../src/lib/ielts/dictation.ts';
import { recordedDictations, readyDictations } from '../src/lib/ielts/dictation-bank.ts';
import { searchStudy } from '../src/lib/ielts/search.ts';

test('dictation generates valid synthetic plates, flights and reserved fictional phones', () => {
  for (let i = 0; i < 100; i++) {
    assert.match(createDictation('plate'), /^[A-Z]{2}\d{2} [A-Z]{3}$/);
    assert.match(createDictation('flight'), /^[A-Z]{2} [1-9]\d{3}$/);
    assert.match(createDictation('phone'), /^(?:07700 900|020 7946 0|0161 496 0|0306 999 0)\d{3}$/);
  }
  assert.equal(createDictation('plate', () => 0), 'AA00 AAA');
  assert.equal(createDictation('flight', () => 0), 'AA 1000');
  assert.equal(createDictation('phone', () => 0), '07700 900000');
  assert.throws(() => createDictation('unknown'), TypeError);
  for (const bad of [-1, NaN, 1.5, Infinity, 65537]) assert.throws(() => randomIndex(bad), RangeError);
  assert.throws(() => createDictation('plate', () => -1), RangeError);
});
test('dictation preserves leading zeros and accepts spacing and case without discarding unsafe text', () => {
  assert.equal(normalizeDictation(' ab-１２ cdE '), 'AB12CDE');
  assert.equal(normalizeDictation('07700 900123'), '07700900123');
  assert.notEqual(normalizeDictation('AB12CDE<script>'), 'AB12CDE');
});
test('all thirty examples wait for supplied recordings and external audio URLs are rejected', () => {
  for (const bank of Object.values(recordedDictations)) {
    assert.equal(bank.length, 10);
    assert.equal(new Set(bank.map(item => item.answer)).size, 10);
    assert.deepEqual(readyDictations(bank), []);
  }
  const allowed = { answer: 'AB 1234', audio: '/ielts/dictation/audio/flight-1.mp3' };
  assert.deepEqual(readyDictations([allowed, ...['https://example.test/track.mp3', '//example.test/a.mp3', '/ielts/dictation/audio/../secret.mp3', 'data:audio/mp3;base64,abc', '/ielts/dictation/audio/a.mp3?token=private'].map(audio => ({ answer: 'TEST', audio }))]), [allowed]);
});
test('dictation is discoverable, local-only, accessible and does not collect microphone or answer data', () => {
  const source = readFileSync(new URL('../src/pages/ielts/dictation.astro', import.meta.url), 'utf8');
  assert.equal(searchStudy('听写')[0].href, '/ielts/dictation');
  assert.match(source, /录音待更新/);
  assert.match(source, /start\.disabled = ready\.length === 0/);
  assert.match(source, /readyDictations\(recordedDictations/);
  assert.match(source, /pagehide/);
  assert.match(source, /其他词库 · 待更新/);
  assert.match(source, /telemetry=\{false\}/);
  assert.doesNotMatch(source, /fetch\(|sendBeacon|XMLHttpRequest|localStorage|sessionStorage|innerHTML|set:html|getUserMedia|SpeechRecognition|speechSynthesis/);
  assert.match(source, /feedback\.textContent/);
  assert.match(source, /if \(checked \|\| !current/);
  assert.match(source, /maxlength="64"/);
});
