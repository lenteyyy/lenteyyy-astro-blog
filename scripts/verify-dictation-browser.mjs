import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const catalog = JSON.parse(readFileSync('src/lib/ielts/dictation-catalog.json', 'utf8'));
const recordings = JSON.parse(readFileSync('src/lib/ielts/dictation-audio-overrides.json', 'utf8')).records;
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:54979';
const output = process.env.TEST_OUTPUT || '/private/tmp/ielts-dictation-check';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const errors = [], failedRequests = [], external = [], expectedBeacons = [], posts = [];
const expectedBeacon = url => process.env.EXPECT_CLOUDFLARE_BEACON === '1' && /^https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js(?:\/[a-z0-9]+)?$/.test(url);
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('requestfailed', request => { if (!request.failure()?.errorText.includes('ERR_ABORTED')) failedRequests.push(request.url()); });
page.on('request', request => {
  if (request.method() === 'POST') {
    let payload;
    try { payload = request.postDataJSON(); } catch { payload = null; }
    posts.push({ url: request.url(), fields: payload && typeof payload === 'object' ? Object.keys(payload) : [] });
  }
  if (expectedBeacon(request.url())) expectedBeacons.push(request.url());
  else if (!request.url().startsWith(origin) && !request.url().startsWith('data:')) external.push(request.url());
});
const checks = [];
let checkNumber = 0;
// Continue at an unreached boundary after repairing a test fixture, without
// repeating earlier checks. Defaults to a complete run.
const test = async (name, fn) => { checkNumber++; if (checkNumber < Number(process.env.TEST_FROM || 1)) return; await fn(); checks.push(name); console.log('PASS ' + name); };
const settings = async values => {
  await page.locator('[data-open-settings]').click();
  for (const [key, value] of Object.entries(values)) {
    const control = page.locator(`[data-setting="${key}"]`);
    if (typeof value === 'boolean') await control.setChecked(value);
    else if (key === 'volume') await control.fill(String(value));
    else await control.selectOption(String(value));
  }
  await page.locator('[data-close-settings]').click();
};
const word = async () => {
  const audio = await page.locator('[data-audio]').getAttribute('src');
  const item = catalog.items.find(item => item.audio === audio);
  assert.ok(item, 'Current audio belongs to a known word'); return item;
};
const correct = async () => {
  await page.locator('[data-answer]').fill((await word()).answer);
  await page.locator('[data-answer]').press('Enter');
};
try {
  await page.goto(origin + '/ielts/dictation', { waitUntil: 'networkidle' });
  await test('five books, monochrome layout and no horizontal overflow', async () => {
    assert.equal(await page.locator('[data-book]').count(), catalog.books.length);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: output + '/library-desktop.png', fullPage: true });
  });
  await settings({ shuffle: false });
  await test('every book starts with a real decodable MP3', async () => {
    for (const book of catalog.books) {
      await page.locator(`[data-book="${book.id}"]`).click();
      await page.locator('[data-start]').click();
      assert.equal((await word()).id, book.items[0]);
      await page.waitForFunction(() => { const a = document.querySelector('[data-audio]'); return a.readyState >= 2 && !a.paused; });
      await page.locator('[data-exit]').click();
      assert.ok(await page.locator('[data-audio]').evaluate(a => a.paused && !a.getAttribute('src')));
    }
  });
  await test('nineband approved alternative answers work with real audio and default 1x', async () => {
    await page.locator('[data-book="nineband"]').click(); await page.locator('[data-start]').click();
    const first = await word(); assert.equal(first.answer, 'a radio program');
    assert.equal(await page.locator('[data-audio]').evaluate(a => a.playbackRate), 1);
    await page.locator('[data-answer]').fill('radio programme'); await page.locator('[data-answer]').press('Enter');
    assert.ok(await page.locator('[data-next]').isVisible());
    await page.locator('[data-next]').click(); assert.equal((await word()).answer, 'abstract');
    await page.locator('[data-exit]').click();
  });
  await test('wrong answers are text, correction is required, Enter advances once', async () => {
    await page.locator('[data-book="answers"]').click(); await page.locator('[data-size]').selectOption('10');
    await page.locator('[data-start]').click(); const first = await word();
    await page.locator('[data-answer]').fill('<script>globalThis.injected=1</script>');
    await page.locator('[data-answer]').press('Enter');
    assert.equal(await page.locator('[data-next]').isVisible(), false);
    assert.ok((await page.locator('[data-feedback]').textContent()).includes(first.answer));
    assert.equal(await page.evaluate(() => globalThis.injected), undefined);
    await correct(); assert.ok(await page.locator('[data-next]').isVisible());
    await page.waitForFunction(() => !document.querySelector('[data-next]').disabled);
    await page.locator('[data-next]').press('Enter'); assert.notEqual((await word()).id, first.id);
    await page.locator('[data-answer]').press('Alt+r');
    await page.waitForFunction(() => document.querySelector('[data-audio]').currentTime < 1);
    await page.screenshot({ path: output + '/practice-desktop.png', fullPage: true });
    await page.locator('[data-exit]').click();
  });
  await test('wrong IDs persist without typed text; review and clear work', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ielts-dictation-wrong-v1')));
    assert.equal(stored.length, 1); assert.ok(catalog.items.some(item => item.id === stored[0]));
    assert.ok(!(await page.evaluate(() => JSON.stringify({ ...localStorage }))).includes('globalThis.injected'));
    await page.locator('[data-review]').click(); assert.equal((await word()).id, stored[0]);
    await correct(); await page.locator('[data-next]').click();
    assert.ok(await page.locator('[data-result]').isVisible());
    await page.locator('[data-library-button]').click();
    assert.equal(await page.locator('[data-wrong-count]').textContent(), '0');
  });
  await test('P1 filters, leading zero, playback rate and automatic submission', async () => {
    await page.locator('[data-book="p1"]').click(); await page.locator('[data-category]').selectOption('phone');
    await settings({ autoSubmit: true, showWord: true, fontSize: 36, repeats: 2 });
    await page.locator('[data-start]').click(); const current = await word();
    assert.equal(current.category, 'phone'); assert.ok(current.answer.startsWith('0'));
    assert.equal(await page.locator('[data-prompt]').textContent(), current.answer);
    await page.locator('[data-quick-rate]').selectOption('0.75');
    assert.equal(await page.locator('[data-audio]').evaluate(a => a.playbackRate), .75);
    assert.equal(await page.locator('[data-answer]').evaluate(a => getComputedStyle(a).fontSize), '36px');
    await page.evaluate(() => { window.dictationPlayCount = 0; document.addEventListener('playing', event => { if (event.target.matches('[data-audio]')) window.dictationPlayCount++; }, true); });
    await page.locator('[data-play]').click();
    await page.waitForFunction(() => window.dictationPlayCount >= 2, undefined, { timeout: 30000 });
    await page.locator('[data-answer]').fill(current.answer.replaceAll(' ', '-'));
    assert.ok(await page.locator('[data-next]').isVisible());
    await page.locator('[data-exit]').click();
  });
  await test('wrong-word loop finishes only after two consecutive correct repetitions', async () => {
    await settings({ autoSubmit: false, showWord: false, fontSize: 24, repeats: 1, rate: 1, requireCorrection: false, loopWrong: true, continuous: false });
    await page.locator('[data-book="answers"]').click(); await page.locator('[data-size]').selectOption('10'); await page.locator('[data-start]').click();
    const first = (await word()).id;
    await page.locator('[data-answer]').fill('wrong'); await page.locator('[data-answer]').press('Enter'); await page.locator('[data-next]').click();
    for (let i = 0; i < 9; i++) {
      // Wait for the recording before keyboard submission: ended may move focus
      // from the input to Next during a synthetic Enter sequence otherwise.
      await page.waitForFunction(() => document.querySelector('[data-audio]').ended);
      await correct(); await page.locator('[data-next]').click();
    }
    assert.equal((await word()).id, first);
    await correct(); await page.locator('[data-next]').click(); assert.equal((await word()).id, first);
    await correct(); await page.locator('[data-next]').click();
    assert.ok(await page.locator('[data-result]').isVisible());
    assert.match(await page.locator('[data-summary]').textContent(), /首次答对 9 \/ 10/);
    await page.locator('[data-library-button]').click();
  });
  await test('continuous dictation checks and advances; exit cancels pending playback', async () => {
    await settings({ loopWrong: false, continuous: true, interval: 3, requireCorrection: false });
    await page.locator('[data-start]').click(); const first = (await word()).id;
    await page.locator('[data-answer]').fill((await word()).answer);
    await page.waitForFunction(id => !document.querySelector('[data-audio]').getAttribute('src')?.includes(id), first, { timeout: 10000 });
    await page.locator('[data-exit]').click(); await page.waitForTimeout(4500);
    assert.ok(await page.locator('[data-library]').isVisible());
    assert.ok(await page.locator('[data-audio]').evaluate(a => a.paused && !a.getAttribute('src')));
  });
  await test('settings keyboard closure, narrow layout and dark theme', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('[data-open-settings]').click();
    assert.ok(await page.locator('[data-settings]').isVisible()); await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-settings]').isVisible(), false);
    await page.evaluate(() => { document.documentElement.dataset.ieltsTheme = 'dark'; });
    await page.screenshot({ path: output + '/library-mobile-dark.png', fullPage: true });
    await page.locator('[data-start]').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: output + '/practice-mobile-dark.png', fullPage: true });
    await page.locator('[data-exit]').click();
  });
  await test('no browser errors, failed resources or third-party requests', async () => {
    assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []); assert.deepEqual(external, []);
  });
  await test('deck and mature serve the verified replacement bytes and retain clear playback at every rate', async () => {
    for (const [book, answer] of [['nineband', 'deck'], ['spelling', 'mature']]) {
      const item = catalog.items.find(item => item.answer === answer);
      const verified = recordings.find(record => record.id === item.id);
      await page.evaluate(() => localStorage.removeItem('ielts-dictation-settings-v1'));
      await page.goto(`${origin}/ielts/dictation?book=${book}&word=${answer}`, { waitUntil: 'networkidle' });
      await page.locator('[data-start]').click();
      assert.equal((await word()).id, item.id);
      const response = await page.request.get(origin + item.audio);
      assert.equal(response.status(), 200);
      assert.equal(createHash('sha256').update(await response.body()).digest('hex'), verified.sha256);
      await page.waitForFunction(() => document.querySelector('[data-audio]').currentTime > 0);
      for (const value of ['0.75', '0.9', '1', '1.25', '1.5']) {
        await page.locator('[data-quick-rate]').selectOption(value);
        assert.equal(await page.locator('[data-audio]').evaluate(a => a.playbackRate), Number(value));
        assert.equal(await page.locator('[data-audio]').evaluate(a => a.preservesPitch), true);
      }
      await page.locator('[data-play]').click();
      await page.locator('[data-answer]').fill(answer);
      await page.locator('[data-answer]').press('Enter');
      assert.equal((await word()).id, item.id);
      assert.equal(await page.locator('[data-next]').isDisabled(), true);
      await page.waitForFunction(() => document.querySelector('[data-audio]').ended && !document.querySelector('[data-next]').disabled);
      await page.locator('[data-exit]').click();
    }
    assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []); assert.deepEqual(external, []);
  });
  assert.ok(posts.every(request => process.env.EXPECT_CLOUDFLARE_BEACON === '1' && request.url.startsWith(origin + '/cdn-cgi/rum') && request.fields.every(field => !/answer|input|keystroke/i.test(field))), 'Unexpected answer or application upload');
  console.log(JSON.stringify({ browser_checks: checks.length, console_errors: errors.length, failed_requests: failedRequests.length, unexpected_external_requests: external.length, cloudflare_beacon_scripts: expectedBeacons.length, post_requests: posts, screenshots: output }));
} finally { await browser.close(); }
