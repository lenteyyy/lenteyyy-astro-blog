import test from 'node:test';
import assert from 'node:assert/strict';
import { DictationPlayback } from '../src/lib/ielts/dictation-audio.ts';

function fixture() {
  const elements = [], events = [];
  const player = new DictationPlayback(() => {
    const element = { src: '', play: () => Promise.resolve(), pause() { this.paused = true; }, removeAttribute() { this.src = ''; }, load() { this.released = true; } };
    elements.push(element); return element;
  }, Object.fromEntries(['loading', 'playing', 'ended', 'error'].map(event => [event, () => events.push(event)])));
  return { player, elements, events };
}
const source = '/ielts/dictation/audio/word-test.mp3';
test('every playback owns a fresh decoder and releases the previous source', () => {
  const { player, elements } = fixture();
  for (let i = 0; i < 2000; i++) player.play(source, { rate: .9, volume: .7 });
  assert.equal(elements.length, 2000);
  assert.ok(elements.slice(0, -1).every(element => element.paused && element.released && !element.src && !element.onended));
  assert.equal(elements.at(-1).src, source);
  assert.equal(elements.at(-1).preservesPitch, true);
  assert.equal(elements.at(-1).defaultPlaybackRate, .9);
});
test('old ended, playing, metadata and rejection callbacks cannot affect the next word', async () => {
  const { player, elements, events } = fixture();
  player.play(source, { rate: 1, volume: 1 });
  const stale = ['onended', 'onplaying', 'onloadedmetadata', 'onerror'].map(key => elements[0][key]);
  player.play(source, { rate: .75, volume: .5 });
  for (const callback of stale) callback();
  assert.deepEqual(events, ['loading', 'loading']);
  elements[1].onplaying(); elements[1].onended(); elements[1].onended();
  assert.deepEqual(events, ['loading', 'loading', 'playing', 'ended']);
});
test('updated rate survives metadata loading, with pitch protection and exact volume', () => {
  const { player, elements } = fixture();
  player.play(source, { rate: 1, volume: 1 });
  player.setOptions({ rate: .9, volume: .4 }); elements[0].onloadedmetadata();
  assert.equal(elements[0].playbackRate, .9); assert.equal(elements[0].volume, .4);
  player.stop(); assert.equal(elements[0].src, '');
});
test('invalid URLs and options never start untrusted playback', () => {
  const { player, elements } = fixture();
  for (const url of ['https://example.test/a.mp3', '//example.test/a.mp3', '/ielts/dictation/audio/../private.mp3']) assert.throws(() => player.play(url, { rate: 1, volume: 1 }));
  for (const options of [{ rate: NaN, volume: 1 }, { rate: 1, volume: -1 }, { rate: 10, volume: 1 }]) assert.throws(() => player.setOptions(options));
  assert.equal(elements.length, 0);
});
