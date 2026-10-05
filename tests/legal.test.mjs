import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('legal pages are public, prerendered and contain no collection forms or unsafe HTML', () => {
  for (const path of ['src/pages/ielts/privacy.astro', 'src/pages/ielts/terms.astro']) {
    const page = source(path);
    assert.match(page, /export const prerender = true/);
    assert.doesNotMatch(page, /getAuthContext|Astro\.redirect|set:html|<form|<input|<iframe/);
    assert.match(page, /mailto:lenteywang@gmail\.com/);
  }
  assert.match(source('src/layouts/IeltsLegalLayout.astro'), /telemetry=\{false\}/);
});
test('both homepages expose the same canonical policy and terms routes', () => {
  for (const path of ['src/components/ielts/LegalLinks.astro', 'src/layouts/BaseLayout.astro']) {
    assert.match(source(path), /href="\/ielts\/privacy"/);
    assert.match(source(path), /href="\/ielts\/terms"/);
  }
  assert.match(source('src/layouts/IeltsLayout.astro'), /<LegalLinks \/>/);
  for (const route of ['/ielts/privacy', '/ielts/terms']) assert.ok(source('src/pages/sitemap.xml.ts').includes(`canonicalUrl('${route}')`));
});
test('privacy describes actual Google scopes, providers, local answers and deletion contact', () => {
  const page = source('src/pages/ielts/privacy.astro');
  for (const term of ['Google', 'Gmail', 'Google Drive', 'Supabase', 'Vercel', 'Resend', 'Cookie', '当前浏览器', '删除', 'Limited Use']) assert.ok(page.includes(term));
  assert.match(page, /Google 账户的授权管理撤销登录授权/);
  assert.match(page, /无法保证任何系统绝对安全/);
  assert.doesNotMatch(page, /保证绝对安全|承诺绝对安全|永不泄露|自动删除所有|不收集任何/);
});
