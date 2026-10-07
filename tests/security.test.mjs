import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { Marked } from 'marked';
import { readJson, sameOrigin, cleanLine, cleanText } from '../src/lib/ielts/http.ts';
import { isBookableDate, bookingWindow } from '../src/lib/ielts/booking-window.ts';
import { rateLimitAddress } from '../src/lib/ielts/rate-policy.ts';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const evaluate = (path, context = {}) => {
  const exports = {};
  const code = ts.transpileModule(source(path).replace(/^import .*;\n/gm, '').replaceAll('import.meta.env.PROD', 'true'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, Response, Request, URL, TextEncoder, TextDecoder, crypto, ...context });
  return exports;
};
const request = body => new Request('https://www.lenteyyy.com/api/test', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body,
});

test('JSON bodies are bounded while streaming, including multibyte and chunked requests', async () => {
  assert.deepEqual(await readJson(request('{"ok":true}')), { ok: true });
  await assert.rejects(readJson(request('{"x":"汉字"}'), 10), /payload_too_large/);
  let reads = 0, cancelled = false;
  const stream = new ReadableStream({
    pull(controller) { reads++; controller.enqueue(new Uint8Array(1024)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(readJson(new Request('https://www.lenteyyy.com/api/test', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: stream, duplex: 'half',
  }), 1500), /payload_too_large/);
  assert.equal(cancelled, true);
  assert.ok(reads <= 3, 'stop before buffering the rest of the stream');
  for (const value of ['', 'null', 'true', '[]', '"text"', '{bad']) {
    await assert.rejects(readJson(request(value)), /invalid_json/);
  }
  await assert.rejects(readJson(new Request('https://www.lenteyyy.com', {
    method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}',
  })), /invalid_content_type/);
});

test('CSRF checks reject cross-origin, missing and malformed origins', () => {
  for (const origin of ['', 'null', 'https://www.lenteyyy.com.attacker.test', 'http://www.lenteyyy.com']) {
    assert.equal(sameOrigin(new Request('https://www.lenteyyy.com/api/test', { headers: origin ? { origin } : {} })), false);
  }
  assert.equal(sameOrigin(new Request('https://www.lenteyyy.com/api/test', { headers: { origin: 'https://www.lenteyyy.com' } })), true);
});

test('changing user-agent or arbitrary Cloudflare headers cannot reset main-site limits', () => {
  const a = new Request('https://www.lenteyyy.com', { headers: { 'x-vercel-forwarded-for': '192.0.2.1', 'cf-connecting-ip': '192.0.2.2', 'user-agent': 'a' } });
  const b = new Request('https://www.lenteyyy.com', { headers: { 'x-vercel-forwarded-for': '192.0.2.1', 'cf-connecting-ip': '192.0.2.3', 'user-agent': 'b' } });
  assert.equal(rateLimitAddress(a), rateLimitAddress(b));
  const main = source('src/lib/rate-limit.ts');
  assert.match(main, /rateLimitAddress\(request\)/);
  assert.doesNotMatch(main, /cf-connecting-ip|user-agent|x-real-ip/);
});

test('unverified sessions cannot read private data or gain owner access', async () => {
  for (const email of ['lenteyteytey@gmail.com', 'student@example.test']) {
    let writes = 0, clears = 0;
    const auth = evaluate('src/lib/ielts/auth.ts', {
      isAdminEmail: value => value === 'lenteyteytey@gmail.com',
      createPublicClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u', email, email_confirmed_at: null } } }) } }),
      createServiceClient: () => { writes++; throw new Error('Unexpected private write'); },
    });
    const cookies = { get: () => ({ value: 'test' }), delete: () => { clears++; } };
    assert.equal(await auth.getAuthContext(cookies), undefined);
    assert.equal(writes, 0);
    assert.equal(clears, 2);
  }
});

test('global email budgets stop distributed spam before creating codes or sending mail', async () => {
  for (const denied of ['otp-global-hour', 'otp-global-day']) {
    let sideEffects = 0;
    const unexpected = () => { sideEffects++; throw new Error('Unexpected mail or database write'); };
    const handler = evaluate('src/pages/api/ielts/auth/request-code.ts', {
      sameOrigin: () => true, readJson: async () => ({ email: 'test@example.test', legalConsent: true }),
      normalizeEmail: value => value, claimRateLimit: async (_request, scope) => scope !== denied,
      createSixDigitCode: unexpected, createServiceClient: unexpected, sendLoginCode: unexpected,
      json: (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers }),
    });
    const response = await handler.POST({ request: {} });
    assert.equal(response.status, 429);
    assert.equal(sideEffects, 0);
    assert.equal(response.headers.get('retry-after'), '60');
  }
});

test('markdown and URLs cannot inject active HTML or unsafe navigation', () => {
  const markdown = evaluate('src/lib/markdown.ts', { Marked, mediaManifest: {}, translateText: text => text });
  for (const value of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '//attacker.test', '/\\attacker.test', 'https:\\attacker.test', 'java\nscript:alert(1)']) {
    assert.equal(markdown.safeLinkUrl(value), '', value);
  }
  const html = markdown.renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[attack](javascript:alert%281%29)\n\n![x](data:text/html,bad)');
  assert.doesNotMatch(html, /<script\b|<img\b|href="javascript:|src="data:/i);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(markdown.safeLinkUrl('/ielts'), '/ielts');
});

test('database migrations prevent direct browser writes from bypassing server validation', () => {
  for (const path of ['infra/ielts-schema.sql', 'infra/ielts-security-20261007.sql']) {
    const sql = source(path);
    assert.match(sql, /revoke all on table public\.ielts_profiles, public\.ielts_materials,[\s\S]*?public\.ielts_bookings, public\.ielts_rate_limits[\s\S]*?from public, anon, authenticated/);
    assert.doesNotMatch(sql, /create policy "users create own IELTS bookings"/);
  }
});

test('students cannot confirm appointments, cancel others, or access owner upload endpoints', async () => {
  const auth = { user: { id: 'student' }, email: 'student@example.test', role: 'student' };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
  let writes = 0;
  const query = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { user_id: 'other', email: 'other@example.test', status: 'pending' }, error: null }), update() { writes++; throw new Error('Unexpected write'); } };
  let body = { id: '11111111-1111-4111-8111-111111111111', action: 'confirm' };
  const handler = evaluate('src/pages/api/ielts/bookings.ts', {
    json, sameOrigin: () => true, getAuthContext: async () => auth,
    claimRateLimit: async () => true, readJson: async () => body,
    createServiceClient: () => ({ from: () => query }),
  });
  assert.equal((await handler.PATCH({ request: {}, cookies: {} })).status, 403);
  body.action = 'cancel';
  assert.equal((await handler.PATCH({ request: {}, cookies: {} })).status, 403);
  assert.equal(writes, 0);
  for (const path of ['src/pages/api/ielts/materials/index.ts', 'src/pages/api/ielts/materials/upload-url.ts']) {
    const upload = evaluate(path, { json, sameOrigin: () => true, getAuthContext: async () => auth, createServiceClient: () => { throw new Error('Unexpected owner access'); } });
    assert.equal((await upload.POST({ request: {}, cookies: {} })).status, 403);
  }
});

test('student booking responses filter by owner and never disclose contact data', async () => {
  const filters = [];
  const query = { select() { return this; }, order() { return this; }, limit() { return this; }, eq(...args) { filters.push(args); return this; }, then(resolve) { resolve({ data: [{ id: 'booking', email: 'private@example.test', name: 'Private name', contact: 'Private phone', notes: 'Private note', status: 'pending', lesson_time: '8:30–10:00' }], error: null }); } };
  const handler = evaluate('src/pages/api/ielts/bookings.ts', {
    getAuthContext: async () => ({ user: { id: 'student' }, role: 'student' }),
    createServiceClient: () => ({ from: () => query }),
    json: (body, status = 200) => new Response(JSON.stringify(body), { status }),
  });
  const response = await handler.GET({ request: new Request('https://www.lenteyyy.com/api/ielts/bookings?scope=admin'), cookies: {} });
  assert.deepEqual(filters, [['user_id', 'student']]);
  const text = await response.text();
  assert.doesNotMatch(text, /private@example|Private name|Private phone|Private note/);
  assert.equal(response.status, 200);
});

test('invalid, duplicated, distant and excessive batch bookings cause no writes or mail', async () => {
  const date = bookingWindow().first;
  const item = { date, time: '8:30–10:00', subject: '阅读' };
  let body;
  let effects = 0;
  const unexpected = () => { effects++; throw new Error('Unexpected database or mail'); };
  const handler = evaluate('src/pages/api/ielts/bookings.ts', {
    sameOrigin: () => true, getAuthContext: async () => ({ user: { id: 'student' }, email: 'student@example.test', role: 'student' }),
    claimRateLimit: async () => true, readJson: async () => body, cleanLine, cleanText, isBookableDate,
    createServiceClient: unexpected, sendBookingEmails: unexpected,
    json: (value, status = 200) => new Response(JSON.stringify(value), { status }),
  });
  for (const bookings of [[], Array(5).fill(item), [item, item], [{ ...item, date: '2099-01-01' }], [{ ...item, date: '2026-02-30' }], [{ ...item, time: '其他时间', customTime: '' }]]) {
    body = { name: 'Test', consent: true, bookings };
    assert.equal((await handler.POST({ request: {}, cookies: {} })).status, 400);
  }
  assert.equal(effects, 0);
});
