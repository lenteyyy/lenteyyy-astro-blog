import { execFileSync } from 'node:child_process';
import { secretFindings } from './secret-patterns.mjs';
import { localSecretValues } from './local-secrets.mjs';

// Read reachable text blobs locally; neither their content nor matches leave
// this process. Do not rewrite repository history or test credentials online.
const objects = execFileSync('git', ['rev-list', '--objects', '--all'], { encoding: 'utf8', maxBuffer: 32_000_000 });
const blobs = new Map();
for (const line of objects.trim().split('\n')) {
  const space = line.indexOf(' ');
  if (space < 0) continue;
  const hash = line.slice(0, space), file = line.slice(space + 1);
  if (/\.(?:[cm]?[jt]sx?|astro|json|md|ya?ml|toml|ini|conf|txt|sql|sh|pem|key|svg|xml|css|html|env|log)$|(?:^|\/)\.(?:env[^/]*|npmrc|gitconfig)$/i.test(file)) blobs.set(hash, file);
}
const failures = [];
const knownValues = localSecretValues();
let scanned = 0;
for (const [blob, file] of blobs) {
  const size = Number(execFileSync('git', ['cat-file', '-s', blob], { encoding: 'utf8' }));
  if (size > 4_000_000) { failures.push({ file, blob, kind: 'oversized text blob needs review' }); continue; }
  const text = execFileSync('git', ['cat-file', 'blob', blob], { encoding: 'utf8', maxBuffer: 4_100_000 });
  scanned++;
  for (const kind of secretFindings(text, knownValues)) failures.push({ file, blob, kind });
}
console.log(JSON.stringify({ reachableTextBlobs: scanned, findings: failures }));
if (failures.length) process.exitCode = 1;
