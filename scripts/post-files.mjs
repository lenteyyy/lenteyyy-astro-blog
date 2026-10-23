import { readdir } from 'node:fs/promises';
import path from 'node:path';

// Match the recursive runtime content glob; validation must not skip subfolders.
export async function postFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Article symlink rejected: ${relative}`);
    if (entry.isDirectory()) files.push(...await postFiles(directory, relative));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(relative);
  }
  return files.sort();
}
