import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { safeIeltsNext, oauthOrigin, oauthMemoryStorage, parseOAuthPending, validGoogleAuthorizationUrl, OAUTH_STORAGE_KEY } from '../src/lib/ielts/oauth-policy.ts';
import { rateLimitAddress } from '../src/lib/ielts/rate-policy.ts';

test('Google login keeps its accessible label and serves the official logo locally', () => {
	const page = readFileSync(new URL('../src/pages/ielts/index.astro', import.meta.url), 'utf8');
	assert.match(page, /data-google-login><img src="\/assets\/google-g\.png" width="20" height="20" alt="" aria-hidden="true"\s*\/><span data-google-login-label>使用 Google 登录<\/span><\/button>/);
	const logo = readFileSync(new URL('../public/assets/google-g.png', import.meta.url));
	assert.equal(logo.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
	assert.doesNotMatch(page, /<img[^>]+src="https:\/\/[^\"]*google/);
});

test('rate limits cannot be reset by rotating user agent or spoofing Cloudflare headers', () => {
	const request = headers => new Request('https://www.lenteyyy.com/api/ielts/auth/google', { headers });
	assert.equal(rateLimitAddress(request({ 'x-vercel-forwarded-for': '192.0.2.1', 'x-forwarded-for': '192.0.2.2', 'cf-connecting-ip': '192.0.2.3' })), '192.0.2.1');
	assert.equal(rateLimitAddress(request({ 'x-forwarded-for': '192.0.2.2', 'user-agent': 'changed', 'cf-connecting-ip': '192.0.2.4' })), '192.0.2.2');
	assert.equal(rateLimitAddress(request({ 'x-forwarded-for': '192.0.2.2', 'user-agent': 'original' })), '192.0.2.2');
	assert.equal(rateLimitAddress(request({ 'cf-connecting-ip': '192.0.2.5', 'x-real-ip': '192.0.2.6' })), 'unknown');
});

test('Google login destinations cannot redirect outside IELTS', () => {
	for (const path of ['/ielts', '/ielts#booking', '/ielts/management', '/ielts/entry-test', '/ielts/mock/test-1', '/ielts/entry-test?subject=reading', '/ielts/mock/test-1?subject=writing']) assert.equal(safeIeltsNext(path), path);
	for (const path of ['//evil.test', 'https://evil.test', '/ielts/\\evil.test', '/ielts/%2f%2fevil.test', '/ielts/../api', '/ielts/management?next=https://evil.test', '/ielts/mock/test-1?subject=writing&next=https://evil.test', '/ielts/entry-test?subject=admin', '/ielts/entry-test?subject=%72eading', null, '<script>']) assert.equal(safeIeltsNext(path), '/ielts');
	assert.equal(oauthOrigin('https://www.lenteyyy.com/api/ielts/auth/google', true), 'https://www.lenteyyy.com');
	assert.equal(oauthOrigin('http://localhost:4321/ielts', false), 'http://localhost:4321');
	for (const url of ['https://evil.test', 'https://lenteyyy.com', 'http://www.lenteyyy.com', 'https://www.lenteyyy.com.evil.test']) assert.throws(() => oauthOrigin(url, true));
});

test('SDK generates S256 PKCE and stores no auth/provider tokens in pending cookies', async () => {
	const storage = oauthMemoryStorage();
	const client = createClient('https://example.supabase.co', 'public-test-key', { auth: { storage, storageKey: OAUTH_STORAGE_KEY, persistSession: true, flowType: 'pkce', autoRefreshToken: false, detectSessionInUrl: false } });
	const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://www.lenteyyy.com/api/ielts/auth/google/callback?state=test', skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } } });
	assert.equal(error, null);
	assert.ok(validGoogleAuthorizationUrl(data.url, 'https://example.supabase.co'));
	const url = new URL(data.url);
	const callback = new URL(url.searchParams.get('redirect_to'));
	assert.equal(callback.searchParams.get('state'), 'test');
	const flowId = data.flowId;
	assert.ok(flowId);
	const snapshot = storage.pkceSnapshot();
	const slotKey = Object.keys(snapshot).find(key => key.includes(flowId));
	assert.ok(slotKey);
	const verifier = JSON.parse(snapshot[slotKey]);
	assert.equal(createHash('sha256').update(verifier).digest('base64url'), url.searchParams.get('code_challenge'));
	storage.setItem(OAUTH_STORAGE_KEY, JSON.stringify({ access_token: 'secret', refresh_token: 'secret', provider_token: 'secret' }));
	assert.doesNotMatch(JSON.stringify(storage.pkceSnapshot()), /access_token|refresh_token|provider_token|secret/);
	const pending = { state: 'a'.repeat(64), createdAt: Date.now(), next: '/ielts#booking', storage: snapshot };
	assert.deepEqual(parseOAuthPending(JSON.stringify(pending)), pending);
	assert.equal(parseOAuthPending(JSON.stringify(pending), pending.createdAt + 601000), undefined);
	assert.equal(parseOAuthPending(JSON.stringify({ ...pending, next: '//evil.test' })), undefined);
	assert.equal(parseOAuthPending(JSON.stringify({ ...pending, storage: { token: 'secret' } })), undefined);
	assert.equal(parseOAuthPending(JSON.stringify({ ...pending, storage: null })), undefined);
	assert.equal(parseOAuthPending('{broken'), undefined);
	assert.equal(parseOAuthPending(JSON.stringify({ ...pending, createdAt: Date.now() + 60000 })), undefined);
	assert.equal(validGoogleAuthorizationUrl(data.url.replace('https://example.supabase.co', 'https://evil.test'), 'https://example.supabase.co'), false);
	assert.equal(validGoogleAuthorizationUrl(data.url.replace('code_challenge_method=s256', 'code_challenge_method=plain'), 'https://example.supabase.co'), false);
});

test('callback verifies browser binding and trusted identity before setting a session', () => {
	const callback = readFileSync(new URL('../src/pages/api/ielts/auth/google/callback.ts', import.meta.url), 'utf8');
	assert.match(callback, /constantTimeEqual\(pending.state, state\)/);
	assert.match(callback, /exchangeCodeForSession\(code, flowId/);
	assert.match(callback, /client.auth.getUser\(data.session.access_token\)/);
	assert.match(callback, /email_confirmed_at/);
	assert.ok(callback.indexOf('client.auth.getUser') < callback.indexOf('setAuthSession(cookies'));
	assert.match(callback, /'referrer-policy': 'no-referrer'/);
	assert.doesNotMatch(callback, /console\.|JSON.stringify\(data\)|user_metadata/);
	const start = readFileSync(new URL('../src/pages/api/ielts/auth/google/index.ts', import.meta.url), 'utf8');
	assert.match(start, /sameOrigin\(request\)/);
	assert.match(start, /claimRateLimit/);
	assert.doesNotMatch(start, /sendEmail|resend|access_type.*offline|gmail|drive/);
	const server = readFileSync(new URL('../src/lib/ielts/oauth.ts', import.meta.url), 'utf8');
	assert.match(server, /httpOnly: true/);
	assert.match(server, /__Host-ielts_google/);
	assert.match(server, /sameSite: 'lax'/);
});
