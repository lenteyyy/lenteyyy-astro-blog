import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Only Astro's installed, reviewed client:load bootstrap and island runtime are
// authorized. Never derive allowlisted hashes from arbitrary rendered content.
const root = dirname(createRequire(import.meta.url).resolve('astro/package.json'));
const runtime = await Promise.all([
  'dist/runtime/client/load.prebuilt.js',
  'dist/runtime/server/astro-island.prebuilt.js',
].map(async path => (await import(pathToFileURL(join(root, path)).href)).default));
const hash = text => `sha256-${createHash('sha256').update(text).digest('base64')}`;
const expected = new Set(runtime.map(hash));
const policy = JSON.parse(readFileSync('vercel.json', 'utf8')).headers
  .find(rule => rule.source === '/ielts(.*)').headers
  .find(header => header.key === 'Content-Security-Policy').value;
const allowed = new Set([...policy.matchAll(/'([sS]ha256-[^']+)'/g)].map(match => match[1]));
if (allowed.size !== expected.size || [...expected].some(value => !allowed.has(value))) {
  throw Error('IELTS CSP framework hashes changed: review the installed Astro runtime before updating vercel.json.');
}
const walk = folder => readdirSync(folder, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? walk(join(folder, entry.name)) : [join(folder, entry.name)]);
let pages = 0;
for (const file of walk('dist/client/ielts').filter(file => file.endsWith('.html'))) {
  pages++;
  const html = readFileSync(file, 'utf8');
  for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/i.test(attributes) || /\btype\s*=\s*["']application\/json["']/i.test(attributes)) continue;
    if (!expected.has(hash(body))) throw Error(`Unapproved executable inline script in ${file}`);
  }
}
console.log(`IELTS CSP verified: ${pages} built pages; only two pinned Astro runtime hashes can execute inline.`);
