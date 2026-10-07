import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchStudy } from '../src/lib/ielts/search.ts';
import { isAdminEmail } from '../src/lib/ielts/config.ts';
const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const home = source('src/pages/ielts/index.astro');

test('search finds sections and entrance test without sending queries elsewhere', () => {
  assert.equal(searchStudy('').length, 5);
  assert.ok(searchStudy('入学').some(item => item.href === '/ielts/entry-test'));
  assert.ok(searchStudy('预约 时间').some(item => item.section === 'booking'));
  assert.ok(searchStudy('ＣＡＭＢＲＩＤＧＥ').some(item => item.section === 'mock'));
  assert.deepEqual(searchStudy('不存在的内容'), []);
});
test('search does not expose private material metadata or account details', () => {
  const material = { id: '11111111-1111-4111-8111-111111111111', title: '<img src=x onerror=alert(1)>', category: '阅读', description: '词汇练习', email: 'secret@example.test', storage_path: 'private-path' };
  assert.deepEqual(searchStudy('词汇', [material], false).filter(item => item.materialId), []);
  const result = searchStudy('词汇', [material], true).find(item => item.materialId);
  assert.equal(result.title, material.title);
  assert.deepEqual(Object.keys(result).sort(), ['detail', 'materialId', 'section', 'title']);
  assert.deepEqual(searchStudy('secret@example.test', [material], true), []);
  assert.deepEqual(searchStudy('private-path', [material], true), []);
  assert.ok(searchStudy('词汇', Array.from({ length: 50 }, () => material), true).length <= 20);
  assert.match(home, /title\.textContent|createTextNode\(item\.title\)/);
});
test('management requires the exact verified owner identity, never client roles', () => {
  assert.equal(isAdminEmail('lenteyteytey@gmail.com'), true);
  assert.equal(isAdminEmail('LENTEYTEYTEY@GMAIL.COM'), true);
  for (const email of [undefined, 'lenteyteytey+admin@gmail.com', 'lenteyteytey@gmail.com.attacker.test', 'student@gmail.com']) assert.equal(isAdminEmail(email), false);
  const auth = source('src/lib/ielts/auth.ts');
  assert.match(auth, /client\.auth\.getUser\(accessToken\)/);
  assert.match(auth, /!email \|\| !accessToken \|\| !user\.email_confirmed_at/);
  assert.match(auth, /isAdminEmail\(email\) \? 'admin' : 'student'/);
  assert.doesNotMatch(auth, /user_metadata|app_metadata/);
  const management = source('src/pages/ielts/management.astro');
  assert.match(management, /auth\.role !== 'admin'/);
  assert.match(management, /private, no-store/);
});
test('other contains only entrance test and management entry is inside account menu', () => {
  const other = home.slice(home.indexOf('<section class="module notes-module"'), home.indexOf('<dialog class="search-dialog"'));
  assert.equal((other.match(/<article/g) || []).length, 1);
  assert.match(other, /入学基础测试/);
  assert.doesNotMatch(other, /预约流程|一次约几节|账户登录/);
  assert.equal((home.match(/href="\/ielts\/management"/g) || []).length, 1);
  assert.ok(home.indexOf('data-management-link') > home.indexOf('data-account-panel'));
  assert.match(home, /managementLink\.hidden = session\.role !== 'admin'/);
  assert.doesNotMatch(home, /IELTS STUDY DESK|FOR MORE|其他信息|我的个人简介|FULL<br/);
  assert.match(home, /telemetry=\{false\}/);
  assert.match(home, /button\.selected\) \{[^}]*color: var\(--ielts-card\)/);
});
test('cross-page animation uses a compatible CSS fallback and respects reduced motion', () => {
  const layout = source('src/layouts/IeltsLayout.astro');
  assert.doesNotMatch(layout, /@view-transition/);
  assert.match(layout, /body\.ielts-site \{[^}]*animation: page-in/);
  assert.match(layout, /prefers-reduced-motion: reduce/);
  assert.match(layout, /body\.ielts-site \{ animation: none; \}/);
});
