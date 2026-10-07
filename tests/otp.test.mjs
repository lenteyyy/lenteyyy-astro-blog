import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('concurrent OTP requests consume one challenge and change one account only', async () => {
  // Execute the real handler with isolated service mocks; no real accounts or mail.
  const source = readFileSync(new URL('../src/pages/api/ielts/auth/verify-code.ts', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
  const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  let challenge = {code_hash: 'digest', expires_at: new Date(Date.now() + 60000).toISOString(), attempts: 0};
  let updates = 0;
  const service = {
    from() {
      let removing = false; const filters = {};
      const query = {
        select() { return query; },
        eq(name, value) { filters[name] = value; return query; },
        gt() { return query; }, lt() { return query; },
        delete() { removing = true; return query; },
        async maybeSingle() {
          if (!removing) return {data: challenge && {...challenge}, error: null};
          if (challenge && filters.code_hash === challenge.code_hash) {
            challenge = null; return {data: {email_hash: 'email-hash'}, error: null};
          }
          return {data: null, error: null};
        },
      };
      return query;
    },
    auth: {admin: {
      async listUsers() { return {data: {users: []}, error: null}; },
      async createUser() { updates++; return {error: null}; },
    }},
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports, Response,
    sameOrigin: () => true,
    readJson: async () => ({email: 'test@example.com', code: '123456', password: 'testPassword123', legalConsent: true}),
    normalizeEmail: (value) => value,
    claimRateLimit: async () => true,
    sha256: async () => 'email-hash',
    verificationHash: async () => 'digest',
    constantTimeEqual: (left, right) => left === right,
    ieltsConfig: () => ({secretKey: 'test-only'}),
    createServiceClient: () => service,
    createPublicClient: () => ({auth: {signInWithPassword: async () => ({data: {session: {}, user: {email: 'test@example.com'}}, error: null})}}),
    setAuthSession: () => {},
    json: (body, status = 200) => new Response(JSON.stringify(body), {status}),
  });
  const input = {request: {}, cookies: {}};
  const results = await Promise.all([exports.POST(input), exports.POST(input)]);
  assert.deepEqual(results.map((response) => response.status).sort(), [200, 401]);
  assert.equal(updates, 1);
  assert.equal((await exports.POST(input)).status, 401);
  assert.equal(updates, 1);
});
