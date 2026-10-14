import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
export function deploymentFiles(root = process.cwd()) {
  const paths = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(path.join(root, dir), {withFileTypes:true})) {
      if (entry.isSymbolicLink()) throw Error('Deployment symlink rejected: ' + path.posix.join(dir, entry.name));
      const file = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) walk(file); else if (entry.isFile()) paths.push(file);
    }
  };
  for (const dir of ['src','public','scripts','content/posts']) if(fs.existsSync(path.join(root,dir))) walk(dir);
  for(const file of ['.vercelignore','README.md','astro.config.mjs','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','vercel.json','content/media-manifest.json','.env.example']) if(fs.existsSync(path.join(root,file))) paths.push(file);
  // Git's ignore parser respects directory patterns, recursive globs and negations.
  // Existing Git ignore rules additionally narrow the upload boundary.
  const result = spawnSync('git',['-c','core.excludesFile='+path.join(root,'.vercelignore'),'check-ignore','--no-index','-z','--stdin'],{cwd:root,input:paths.join('\0')+'\0',encoding:'utf8',maxBuffer:8_000_000});
  if (result.error || ![0,1].includes(result.status)) throw Error('Unable to apply deployment ignore rules');
  const ignored = new Set(result.stdout.split('\0'));
  return paths.filter(file => !ignored.has(file) && (!/(?:^|\/)\.env/.test(file) || file === '.env.example')).sort();
}
