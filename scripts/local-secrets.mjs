import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

// Inspect only existing project env files in memory; never read CLI auth files,
// print values, pull production secrets or send them to an external scanner.
export function localSecretValues(root = process.cwd()) {
  const values = new Set();
  for (const folder of [root, path.join(root, '.vercel')]) {
    if (!existsSync(folder)) continue;
    for (const name of readdirSync(folder)) {
      if (!/^\.env(?:\.|$)/.test(name) || name === '.env.example') continue;
      const file = path.join(folder, name), status = lstatSync(file);
      if (status.isSymbolicLink()) throw new Error('Environment symlink rejected');
      if (!status.isFile()) continue;
      for (const [key, raw] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
        if (!/(?:SECRET|TOKEN|PASSWORD|API_KEY|POSTGRES|SERVICE_ROLE|DATABASE_URL)/i.test(key) || /PUBLISHABLE|ANON/i.test(key)) continue;
        const value = raw.trim();
        if (value.length >= 12 && !/placeholder|replace|your[-_]|example/i.test(value)) values.add(value);
      }
    }
  }
  return [...values];
}
