import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:54979';
const output = process.env.TEST_OUTPUT || '/private/tmp/ielts-typing-check';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
// Advance the monotonic clock deterministically, without waiting two minutes.
await context.addInitScript(() => {
	const nativeNow = performance.now.bind(performance);
	window.typingTestOffset = 0;
	performance.now = () => nativeNow() + window.typingTestOffset;
});
const page = await context.newPage();
const errors = [], external = [], failed = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('request', request => { if (!request.url().startsWith(origin) && !request.url().startsWith('data:')) external.push(request.url()); });
page.on('requestfailed', request => { if (!request.failure()?.errorText.includes('ERR_ABORTED')) failed.push(request.url()); });
const check = async (name, fn) => { await fn(); console.log('PASS ' + name); };
try {
	// The local static server cannot run auth; anonymous identity is the only fixture.
	await page.route('**/api/ielts/auth/me', route => route.fulfill({ contentType: 'application/json', body: '{"authenticated":false}' }));
	await page.route('**/api/ielts/availability?*', route => route.fulfill({ contentType: 'application/json', body: '{"unavailable":[]}' }));
	await page.goto(origin + '/ielts#notes', { waitUntil: 'networkidle' });
	await check('Other entry opens the typing page', async () => {
		await page.locator('#notes a[href="/ielts/typing"]').click();
		await page.waitForURL(/\/ielts\/typing\/?$/);
		await page.locator('[data-typing-target] span').first().waitFor();
		assert.equal(await page.locator('h1').textContent(), '打字速度练习');
	});
	const input = page.locator('[data-typing-input]');
	const targetText = () => page.locator('[data-typing-target]').textContent();
	await check('idle clock, 30/60/120 choices, desktop layout', async () => {
		await page.evaluate(() => { window.typingTestOffset += 10000; });
		await page.waitForTimeout(150);
		assert.equal(await page.locator('[data-typing-remaining]').textContent(), '60s');
		for (const duration of ['30', '120', '60']) {
			await page.locator('[data-typing-duration]').selectOption(duration);
			assert.equal(await page.locator('[data-typing-remaining]').textContent(), duration + 's');
		}
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
		await page.screenshot({ path: output + '/desktop.png', fullPage: true });
	});
	await check('real keystrokes start timing, errors and corrections are visible', async () => {
		const prefix = (await targetText()).slice(0, 10);
		await input.pressSequentially(prefix, { delay: 20 });
		await page.evaluate(() => { window.typingTestOffset += 5000; });
		await page.waitForTimeout(150);
		assert.equal(await page.locator('[data-typing-accuracy]').textContent(), '100%');
		assert.ok(Number(await page.locator('[data-typing-wpm]').textContent()) > 0);
		await input.pressSequentially('@');
		assert.equal(await page.locator('[data-typing-errors]').textContent(), '1');
		assert.equal(await page.locator('[data-typing-target] .wrong').count(), 1);
		await input.press('Backspace');
		assert.equal(await page.locator('[data-typing-accuracy]').textContent(), '100%');
	});
	await check('pasting is blocked and markup input never becomes HTML', async () => {
		const before = await input.inputValue();
		assert.equal(await input.evaluate(element => element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true }))), false);
		assert.equal(await input.inputValue(), before);
		await input.pressSequentially('<img>');
		assert.equal(await page.locator('[data-typing-target] img').count(), 0);
	});
	await check('deadline freezes results and rejects subsequent typing', async () => {
		await page.evaluate(() => { window.typingTestOffset += 120000; document.dispatchEvent(new Event('visibilitychange')); });
		assert.equal(await page.locator('[data-typing-remaining]').textContent(), '0s');
		assert.equal(await input.evaluate(element => element.readOnly), true);
		const before = await input.inputValue();
		await input.pressSequentially('extra');
		assert.equal(await input.inputValue(), before);
		assert.match(await page.locator('[data-typing-status]').textContent(), /练习结束/);
	});
	await check('restart resets metrics and keeps text; new text and mode changes work', async () => {
		const text = await targetText();
		await page.locator('[data-typing-restart]').click();
		assert.equal(await input.inputValue(), '');
		assert.equal(await targetText(), text);
		assert.equal(await page.locator('[data-typing-wpm]').textContent(), '0');
		assert.equal(await input.evaluate(element => element.readOnly), false);
		await page.locator('[data-typing-new]').click();
		assert.notEqual(await targetText(), text);
		await page.locator('[data-typing-mode]').selectOption('passage');
		assert.match(await targetText(), /[A-Z].*\./);
		await input.pressSequentially((await targetText()).slice(0, 650));
		assert.ok(await page.locator('[data-typing-target]').evaluate(element => element.scrollTop > 0));
		const current = await page.locator('[data-typing-target] .current').boundingBox();
		const panel = await page.locator('[data-typing-target]').boundingBox();
		assert.ok(current.y >= panel.y && current.y < panel.y + panel.height);
	});
	await check('text completion ends early; keyboard restart and mobile/dark layouts', async () => {
		await page.locator('[data-typing-restart]').click();
		await input.pressSequentially((await targetText()).slice(0, 1));
		await page.evaluate(() => { window.typingTestOffset += 15000; });
		// Fixture for the final character boundary; real typing already checked above.
		await input.fill(await targetText());
		assert.equal(await input.evaluate(element => element.readOnly), true);
		assert.equal(await page.locator('[data-typing-accuracy]').textContent(), '100%');
		await page.locator('[data-typing-restart]').focus();
		await page.keyboard.press('Enter');
		assert.equal(await input.inputValue(), '');
		await page.setViewportSize({ width: 390, height: 844 });
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
		await page.screenshot({ path: output + '/mobile.png', fullPage: true });
		await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
		await page.screenshot({ path: output + '/mobile-dark.png', fullPage: true });
	});
	assert.deepEqual(errors, []);
	assert.deepEqual(external, []);
	assert.deepEqual(failed, []);
	console.log('7 flows passed; zero browser errors, failed requests or external requests.');
} finally { await browser.close(); }
