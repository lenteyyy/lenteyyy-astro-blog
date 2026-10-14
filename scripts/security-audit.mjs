import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { parseEnv } from 'node:util';

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
const environmentFiles = readdirSync('.').filter(name => /^\.env(?:\.|$)/.test(name));
if (existsSync('.vercel')) environmentFiles.push(...readdirSync('.vercel').filter(name => /^\.env(?:\.|$)/.test(name)).map(name => path.join('.vercel', name)));
for (const file of environmentFiles) {
  for (const [name, raw] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
    if (!/(?:SECRET|TOKEN|PASSWORD|API_KEY|POSTGRES|SERVICE_ROLE|DATABASE_URL)/.test(name) || /PUBLISHABLE|ANON/.test(name)) continue;
    const value = raw.trim();
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
if (failures.length) { console.error([...new Set(failures)].join('\n')); process.exitCode = 1; }
else console.log(`Privacy scan passed: ${sources.length} source files, ${client.length} public build files; no detected credentials, unsafe public variables, source maps.`);
