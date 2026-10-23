import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import sharp from 'sharp';
import { secretFindings } from './secret-patterns.mjs';
import { localSecretValues } from './local-secrets.mjs';

// Diagnostics deliberately name files only, never matching secret values.
const walk = dir => readdirSync(dir).flatMap(name => {
  const file = path.join(dir, name);
  const status = lstatSync(file);
  if (status.isSymbolicLink()) throw new Error('Audit symlink rejected: ' + file);
  return status.isDirectory() ? walk(file) : [file];
});
const gitRoot = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
const hasRepository = gitRoot.status === 0 && path.resolve(gitRoot.stdout.trim()) === process.cwd();
const tracked = hasRepository ? execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean) : [];
// CLI/API uploads do not include .git. Keep the public-build guard effective in
// that environment instead of failing the build or scanning an ancestor repo.
const sourceFiles = hasRepository
  ? execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0')
  : [...['src', 'scripts', 'content/posts', 'public'].flatMap(folder => existsSync(folder) ? walk(folder) : []),
    ...readdirSync('.').filter(file => lstatSync(file).isFile())];
const sources = [...new Set(sourceFiles)].filter(file => file && existsSync(file) && /\.(?:tsx?|jsx?|mjs|astro|json|md|sql|ya?ml|svg|txt|xml|css|html)$/.test(file));
const client = walk('dist/client').filter(file => /\.(?:[cm]?js|html|json|xml|css|map|svg|txt)$/.test(file));
const failures = [];
const secretValues = localSecretValues();
for (const file of tracked) if (/(?:^|\/)\.env(?:\.|$)/.test(file) && !/\.env\.example$/.test(file)) failures.push(`Tracked environment file: ${file}`);
for (const file of [...sources, ...client]) {
  const text = readFileSync(file, 'utf8');
  for (const category of secretFindings(text, secretValues)) failures.push(`${category}: ${file}`);
  if (/(?:PUBLIC_|VITE_)[A-Z0-9_]*(?:TOKEN|SERVICE_ROLE|SECRET|API_KEY|POSTGRES_URL|DATABASE_URL|PASSWORD|PRIVATE_KEY)/.test(text)) failures.push(`Unsafe public variable: ${file}`);
}
for (const file of client) {
  const text = readFileSync(file, 'utf8');
  if (/SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|SUPABASE_SECRET_KEY|POSTGRES_URL|UPSTASH_REDIS_REST_(?:TOKEN|URL)|KV_REST_API_(?:TOKEN|URL)|REDIS_URL/.test(text)) failures.push(`Server-only configuration in public build: ${file}`);
  if (/\.map$/.test(file)) failures.push(`Public source map: ${file}`);
}
const publicImages = walk('public').filter(file => /\.(?:png|jpe?g|webp)$/i.test(file));
for (const file of publicImages) {
  const metadata = await sharp(file).metadata();
  if (metadata.exif || metadata.xmp || metadata.iptc) failures.push(`Private image metadata: ${file}`);
}
if (failures.length) { console.error([...new Set(failures)].join('\n')); process.exitCode = 1; }
else console.log(`Privacy scan passed: ${sources.length} source files, ${client.length} public build files, ${publicImages.length} images; no detected credentials, unsafe public variables, source maps or private image metadata.`);
