import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createDictation, randomIndex, normalizeDictation } from '../src/lib/ielts/dictation.ts';
import { recordedDictations, readyDictations } from '../src/lib/ielts/dictation-bank.ts';
import { searchStudy } from '../src/lib/ielts/search.ts';
import { dictationBooks, dictationWords, wordById, DICTATION_RATES, defaultDictationRate, matchAnswer, sanitizeWrongIds, shuffled, DictationSession } from '../src/lib/ielts/dictation-library.ts';

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
  const client = readFileSync(new URL('../src/lib/ielts/dictation-client.ts', import.meta.url), 'utf8');
  assert.equal(searchStudy('听写')[0].href, '/ielts/dictation');
  assert.equal(searchStudy('九分学长')[0].href, '/ielts/dictation');
  assert.match(source, /dictationBooks\.map/);
  assert.match(client, /pagehide/);
  assert.match(source, /telemetry=\{false\}/);
  assert.doesNotMatch(source + client, /sendBeacon|XMLHttpRequest|sessionStorage|innerHTML|set:html|getUserMedia|SpeechRecognition|speechSynthesis|method:\s*['"]POST/);
  assert.deepEqual([...client.matchAll(/fetch\(([^,]+)/g)].map(m=>m[1]),["'/api/ielts/auth/me'"]);
  assert.match(client, /cache:'no-store',signal:token.signal/);
  assert.match(client, /feedback\.textContent/);
  assert.match(client, /localStorage\.setItem\(WRONG_KEY, JSON\.stringify\(wrongIds\)\)/);
  assert.doesNotMatch(client, /localStorage\.setItem[^\n]*input\.value/);
  assert.match(source, /maxlength="128"/);
  assert.match(source, /aria-describedby="dictation-feedback"/);
  assert.match(source, /<dialog/);
});

test('all five books contain only unique entries and valid local MP3s', () => {
  assert.equal(dictationWords.length, 1881);
  assert.equal(new Set(dictationWords.map(word => word.id)).size, 1881);
  assert.deepEqual(dictationBooks.map(book => book.items.length), [414, 244, 212, 50, 1059]);
  for (const book of dictationBooks) {
    assert.equal(new Set(book.items).size, book.items.length);
    for (const id of book.items) assert.ok(wordById.has(id));
  }
  for (const word of dictationWords) {
    assert.match(word.audio, /^\/ielts\/dictation\/audio\/[a-z0-9-]+\.mp3$/);
    assert.ok(word.answer.length > 0 && word.answer.length <= 128);
    assert.ok(existsSync(new URL('../public' + word.audio, import.meta.url)));
  }
});
test('nineband wordbook preserves source-approved variants and identifier leading zeros', () => {
  const book = dictationBooks.find(book => book.id === 'nineband');
  assert.ok(book);
  const byAnswer = new Map(book.items.map(id => [wordById.get(id).answer, wordById.get(id)]));
  assert.ok(matchAnswer('radio programme', byAnswer.get('a radio program')));
  assert.ok(matchAnswer('12th January', byAnswer.get('January 12th')));
  assert.ok(matchAnswer('ten thousand', byAnswer.get('10,000')));
  assert.ok(matchAnswer('AF 741 T', byAnswer.get('AF741T')));
  assert.ok(!matchAnswer('1366435772', byAnswer.get('01366435772')));
  assert.ok(!matchAnswer('<script>abstract</script>', byAnswer.get('abstract')));
  assert.ok(!matchAnswer('radioprogramme', byAnswer.get('a radio program')));
  for (const id of book.items) {
    const word = wordById.get(id);
    assert.ok(word.acceptedAnswers.includes(word.answer));
    assert.ok(word.acceptedAnswers.every(answer => typeof answer === 'string' && answer.length > 0 && answer.length <= 128));
  }
});
test('vocabulary matching keeps word boundaries, punctuation and leading zeros', () => {
  const word = { answer: 'ice pack', category: 'word' };
  assert.ok(matchAnswer(' ICE   PACK ', word));
  assert.ok(!matchAnswer('icepack', word));
  assert.ok(!matchAnswer('<script>ice pack</script>', word));
  assert.ok(matchAnswer('Queen’s Park', { answer: "Queen's Park", category: 'word' }));
  assert.ok(matchAnswer('０７７００-４１２９８６', { answer: '07700 412 986', category: 'phone' }));
  assert.ok(!matchAnswer('7700412986', { answer: '07700 412 986', category: 'phone' }));
  assert.ok(!matchAnswer('615', { answer: '6.15', category: 'word' }));
});
test('wrong-word loops require two consecutive correct attempts and count first answers once', () => {
  const words = dictationWords.slice(0, 2);
  const session = new DictationSession(words, true);
  session.submit(false); session.submit(true);
  assert.equal(session.current.id, words[0].id);
  session.submit(true); assert.equal(session.completed, 1);
  session.submit(false); assert.equal(session.completed, 1);
  session.submit(true); assert.ok(session.current);
  session.submit(true); assert.equal(session.current, undefined);
  assert.equal(session.completed, 2); assert.equal(session.correctFirst, 1);
  assert.equal(session.attempts, 6); assert.ok(session.mastered.has(words[0].id));
  const plain = new DictationSession(words, false);
  plain.submit(false); plain.submit(true);
  assert.equal(plain.current, undefined); assert.equal(plain.completed, 2);
});
test('invalid stored IDs are discarded and shuffle does not mutate books', () => {
  const id = dictationWords[0].id;
  assert.deepEqual(sanitizeWrongIds([id, id, 'constructor', '<script>', null, 1]), [id]);
  assert.deepEqual(sanitizeWrongIds({ ids: [id] }), []);
  const source = [1, 2, 3];
  assert.deepEqual(shuffled(source, () => 0), [2, 3, 1]);
  assert.deepEqual(source, [1, 2, 3]);
  assert.throws(() => shuffled(source, () => -1), RangeError);
});
test('P1 defaults to 0.9 with a separately stored preference; ordinary books keep 1x', () => {
  assert.equal(defaultDictationRate('p1'), .9);
  for (const id of ['answers', 'maps', 'spelling', 'nineband']) assert.equal(defaultDictationRate(id), 1);
  assert.ok(DICTATION_RATES.includes(.9));
  const client = readFileSync(new URL('../src/lib/ielts/dictation-client.ts', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/pages/ielts/dictation.astro', import.meta.url), 'utf8');
  assert.match(client, /selectedBook === 'p1' \? settings\.p1Rate : settings\.rate/);
  assert.match(client, /p1Rate: defaultDictationRate\('p1'\)/);
  assert.equal((page.match(/<option value="0\.9">/g) || []).length, 2);
});
test('all 1881 clarity recordings match verified overrides and retain catalog answers', () => {
  const manifest = JSON.parse(readFileSync(new URL('../src/lib/ielts/dictation-audio-overrides.json', import.meta.url), 'utf8'));
  assert.equal(manifest.records.length, dictationWords.length);
  for (const record of manifest.records) {
    const word = wordById.get(record.id);
    assert.equal(word.answer, record.answer); assert.equal(word.audio, record.audio);
    assert.match(word.audio, /-clear-v[34]\.mp3$/);
    assert.equal(createHash('sha256').update(readFileSync(new URL('../public' + word.audio, import.meta.url))).digest('hex'), record.sha256);
    assert.ok(record.duration_seconds > .5 && record.peak > 500 && record.peak < 32767);
  }
});
test('typing an answer cannot cut audio short and repeat timers remain independent', () => {
  const client = readFileSync(new URL('../src/lib/ielts/dictation-client.ts', import.meta.url), 'utf8');
  assert.match(client, /current \|\| awaitingAudio \|\| verdict/);
  assert.match(client, /audioTimer = setTimeout/);
  assert.match(client, /if \(!awaitingAudio\)/);
  assert.match(client, /next\.disabled = awaitingAudio/);
  assert.match(client, /word\.answer\.toLowerCase\(\) === \(params\.get\('word'\)/);
});

test('reported deck and mature clips are verified replacements, not the defective originals', () => {
  const manifest = JSON.parse(readFileSync(new URL('../src/lib/ielts/dictation-audio-overrides.json', import.meta.url), 'utf8'));
  for (const answer of ['deck', 'mature']) {
    const record = manifest.records.find(record => record.answer === answer);
    assert.ok(record);
    assert.equal(record.asr_validation.exact, true);
    assert.equal(record.asr_validation.transcript.toLowerCase().replace(/[^a-z]/g, ''), answer);
    assert.equal(record.asr_validation.sha256, record.sha256);
    assert.notEqual(record.original_sha256, record.sha256);
  }
});
