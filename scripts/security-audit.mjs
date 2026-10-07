import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Diagnostics deliberately name files only, never matching secret values.
const walk = dir => readdirSync(dir).flatMap(name => {
  const file = path.join(dir, name);
  return statSync(file).isDirectory() ? walk(file) : [file];
});
const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n');
const sources = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .trim().split('\n').filter(file => existsSync(file) && /\.(?:tsx?|jsx?|mjs|astro|json|md|sql|ya?ml)$/.test(file));
const client = walk('dist/client').filter(file => /\.(?:js|html|json|xml|css|map)$/.test(file));
const failures = [];
const secretValues = [];
for (const file of readdirSync('.').filter(name => /^\.env(?:\.|$)/.test(name))) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Z][A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match || /PUBLIC_|(?:SITE_URL|DOMAIN|EMAIL|SUPABASE_URL|PUBLISHABLE|ANON)/.test(match[1])) continue;
    const value = match[2].trim().replace(/^['"]|['"]$/g, '');
    if (value.length >= 20 && !/placeholder|replace|your[-_]|example/i.test(value)) secretValues.push(value);
  }
}
for (const file of tracked) if (/(?:^|\/)\.env(?:\.|$)/.test(file) && !/\.env\.example$/.test(file)) failures.push(`Tracked environment file: ${file}`);
for (const file of [...sources, ...client]) {
  const text = readFileSync(file, 'utf8');
  if (secretValues.some(secret => text.includes(secret))) failures.push(`Secret literal: ${file}`);
  if (/\b(?:ghp_|github_pat_|sk_live_|sb_secret_)[a-zA-Z0-9_-]{20,}/.test(text)) failures.push(`Credential-like literal: ${file}`);
  if (/PUBLIC_[A-Z_]*(?:SERVICE_ROLE|SECRET_KEY|RESEND_API_KEY|POSTGRES_URL|PASSWORD)/.test(text)) failures.push(`Unsafe public variable: ${file}`);
  for (const match of text.matchAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try {
      if (JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString()).role === 'service_role') failures.push(`Service role token: ${file}`);
    } catch { /* A malformed token-like string is not treated as a credential. */ }
  }
}
for (const file of client) {
  const text = readFileSync(file, 'utf8');
  if (/SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|SUPABASE_SECRET_KEY|POSTGRES_URL|UPSTASH_REDIS_REST_TOKEN|KV_REST_API_TOKEN/.test(text)) failures.push(`Server-only configuration in public build: ${file}`);
  if (/\.map$/.test(file)) failures.push(`Public source map: ${file}`);
}
const entry = JSON.parse(readFileSync('src/lib/ielts/entry-test/content.json', 'utf8'));
if (/Listening Script|Reference Answers|answerKeys?|Good afternoon, everyone\. Today/.test(JSON.stringify(entry))) failures.push('Excluded appendix in student test');
const image = readFileSync('public/ielts/entry-test/writing-task-1.png');
for (const marker of ['eXIf', 'tEXt', 'iTXt', 'zTXt']) if (image.includes(Buffer.from(marker))) failures.push(`Chart metadata: ${marker}`);
if (failures.length) { console.error([...new Set(failures)].join('\n')); process.exitCode = 1; }
else console.log(`Privacy scan passed: ${sources.length} source files, ${client.length} public build files; no detected credentials, unsafe public variables, source maps or excluded entry-test content.`);
