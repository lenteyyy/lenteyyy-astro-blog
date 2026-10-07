import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('all login entry points reject missing or non-boolean consent before auth, mail or database work', async () => {
	for (const path of ['login.ts', 'google/index.ts', 'request-code.ts', 'verify-code.ts']) {
		const route = source(`src/pages/api/ielts/auth/${path}`).replace(/^import .*;\n/gm, '').replaceAll('import.meta.env.PROD', 'false');
		const code = ts.transpileModule(route, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
		for (const legalConsent of [undefined, null, false, 'true', 'accepted', 1, [], {}]) {
			const exports = {};
			let calls = 0;
			const unexpected = () => { calls++; throw new Error('Unexpected side effect'); };
			vm.runInNewContext(code, {
				exports, Response,
				sameOrigin: () => true,
				oauthOrigin: () => 'http://localhost:4332',
				readJson: async () => ({ legalConsent }),
				normalizeEmail: unexpected,
				claimRateLimit: unexpected,
				createServiceClient: unexpected,
				createPublicClient: unexpected,
				createOAuthClient: unexpected,
				clearOAuthPending: unexpected,
				setAuthSession: unexpected,
				sendLoginCode: unexpected,
				json: (body, status = 200) => new Response(JSON.stringify(body), { status }),
			});
			const response = await exports.POST({ request: {}, cookies: {} });
			assert.equal(response.status, 400, `${path}: ${JSON.stringify(legalConsent)}`);
			assert.deepEqual(await response.json(), { error: 'consent_required' });
			assert.equal(calls, 0, path);
		}
	}
});

test('both forms require explicit unchecked consent with accessible policy links and disabled initial actions', () => {
	const component = source('src/components/ielts/LoginConsent.astro');
	assert.match(component, /type="checkbox" name="legalConsent" value="accepted" required/);
	assert.doesNotMatch(component, /\bchecked\b|localStorage|sessionStorage|set:html/);
	for (const route of ['terms', 'privacy']) assert.ok(component.includes(`href="/ielts/${route}" target="_blank" rel="noopener noreferrer"`));
	const page = source('src/pages/ielts/index.astro');
	assert.equal((page.match(/<LoginConsent \/>/g) || []).length, 2);
	assert.match(page, /disabled data-google-login/);
	assert.match(page, /type="submit" disabled>登录/);
	assert.match(page, /type="submit" disabled data-password-submit/);
	assert.match(page, /if \(!form \|\| !requireAuthConsent\(form\)\) return/);
	assert.equal((page.match(/if \(!requireAuthConsent\(form\)\) return/g) || []).length, 2);
	assert.match(page, /checkbox\.checked = false/);
	assert.match(page, /button\.disabled = busy \|\| !checkbox\?\.checked/);
});

test('real client consent logic enables only after confirmation, locks concurrent actions and resets on reopening', () => {
	const page = source('src/pages/ielts/index.astro');
	const start = page.indexOf('const syncAuthConsent =');
	const end = page.indexOf('const openAuth =', start);
	assert.ok(start > 0 && end > start);
	const code = ts.transpileModule(page.slice(start, end) + '\nexports.controls = { syncAuthConsent, setAuthBusy, requireAuthConsent, resetAuthConsent };', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
	const exports = {};
	vm.runInNewContext(code, { exports, authDialog: null, messageFor: code => code });
	const checkbox = { checked: false, disabled: false, focused: false, focus() { this.focused = true; } };
	const buttons = [{ disabled: false }, { disabled: false }];
	const message = { textContent: '' };
	const form = {
		dataset: {},
		querySelector: selector => selector.includes('legalConsent') ? checkbox : message,
		querySelectorAll: () => buttons,
	};
	const { syncAuthConsent, setAuthBusy, requireAuthConsent, resetAuthConsent } = exports.controls;
	syncAuthConsent(form);
	assert.ok(buttons.every(button => button.disabled));
	assert.equal(requireAuthConsent(form), false);
	assert.equal(message.textContent, 'consent_required');
	assert.equal(checkbox.focused, true);
	checkbox.checked = true;
	syncAuthConsent(form);
	assert.ok(buttons.every(button => !button.disabled));
	assert.equal(requireAuthConsent(form), true);
	setAuthBusy(form, true);
	assert.ok(buttons.every(button => button.disabled));
	assert.equal(checkbox.disabled, true);
	assert.equal(requireAuthConsent(form), false);
	setAuthBusy(form, false);
	assert.equal(checkbox.disabled, false);
	assert.ok(buttons.every(button => !button.disabled));
	resetAuthConsent(form);
	assert.equal(checkbox.checked, false);
	assert.ok(buttons.every(button => button.disabled));
});

test('copyright is left aligned, year aware and does not claim ownership of third-party test content', () => {
	const footer = source('src/components/ielts/LegalLinks.astro');
	assert.match(footer, /new Date\(\)\.getFullYear\(\)/);
	assert.match(footer, /© \{year\} Lenteyyy/);
	assert.match(footer, /本站原创内容保留所有权利/);
	assert.match(footer, /与 IELTS 官方无隶属关系/);
	assert.doesNotMatch(footer, /IELTS Writing Checker|position:\s*fixed|justify-content:\s*center/);
	assert.match(footer, /flex-wrap: wrap/);
	assert.match(source('src/components/ielts/MockExam.astro'), /legalLinks=\{false\}/);
});
