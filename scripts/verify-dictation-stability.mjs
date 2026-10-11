import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:54979';
const catalog = JSON.parse(readFileSync('src/lib/ielts/dictation-catalog.json', 'utf8'));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const page = await browser.newPage();
const errors = [], failed = [];
page.on('pageerror', error => errors.push(error.message));
page.on('requestfailed', request => { if (!request.failure()?.errorText.includes('ERR_ABORTED')) failed.push(request.url()); });
try {
  await page.goto(origin+'/ielts/dictation/?book=spelling&word=mature', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('[data-book="spelling"]').getAttribute('aria-pressed'), 'true');
  await page.locator('[data-start]').click();
  assert.ok((await page.locator('[data-audio]').getAttribute('src')).includes('word-6d3072649352-clear-v3'));
  await page.locator('[data-exit]').click();
  await page.locator('[data-open-settings]').click();
  await page.locator('[data-setting="shuffle"]').uncheck();
  await page.locator('[data-setting="autoSubmit"]').check();
  await page.locator('[data-setting="repeats"]').selectOption('1');
  await page.locator('[data-close-settings]').click();
  await page.locator('[data-size]').selectOption('50');
  let played = 0;
  for (const book of catalog.books.slice(Number(process.env.TEST_BOOK_FROM || 0))) {
    await page.locator(`[data-book="${book.id}"]`).click();
    await page.locator('[data-start]').click();
    for (const id of book.items.slice(0, 50)) {
      const word = catalog.items.find(item => item.id === id);
      const audio = page.locator('[data-audio]');
      assert.equal(await audio.getAttribute('src'), word.audio);
      await page.waitForFunction(() => { const a=document.querySelector('[data-audio]'); return a.readyState>=2 && !a.paused && a.currentTime>0; });
      assert.equal(await audio.evaluate(a => a.preservesPitch), true);
      assert.equal(await page.locator('audio').count(), 1);
      const old = await audio.elementHandle();
      await page.locator('[data-answer]').fill(word.answer);
      assert.equal(await page.locator('[data-next]').isDisabled(), true);
      await page.keyboard.press('Enter');
      assert.equal(await audio.getAttribute('src'), word.audio);
      // Decode the full file, then use its native EOF event to stress many decoder
      // lifecycles quickly; this is not an artificial dispatch of an ended event.
      await audio.evaluate(a => { if (!Number.isFinite(a.duration)) throw Error('Invalid duration'); a.currentTime=a.duration-.08; });
      await page.waitForFunction(() => document.querySelector('[data-audio]').ended && !document.querySelector('[data-next]').disabled);
      await page.locator('[data-next]').click();
      assert.equal(await old.evaluate(a => a.paused && !a.getAttribute('src')), true);
      played++;
      if (played % 10 === 0) console.log(`CHECKED ${played} recordings in this run`);
    }
    assert.ok(await page.locator('[data-result]').isVisible());
    await page.locator('[data-library-button]').click();
    console.log(`PASS ${book.title}: 50 sequential recordings, no early advance`);
  }
  assert.deepEqual(errors, []); assert.deepEqual(failed, []);
  console.log(JSON.stringify({ sequential_recordings: played, errors: 0, failed_requests: 0, mature_demo: true }));
} finally { await browser.close(); }
