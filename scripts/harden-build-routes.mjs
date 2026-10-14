import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function hardenBuildRoutes(config) {
  const candidates = config.routes.filter(route => route.status === 308 && route.headers?.Location === '/$1');
  if (candidates.length !== 1) throw Error('Review changed Astro trailing-slash routing before release');
  const route = candidates[0];
  const safe = String.raw`^/([^/\\\s].*)/$`;
  if (route.src !== '^/(.*)/$' && route.src !== safe) throw Error('Unrecognized trailing-slash rule');
  route.src = safe;
  return config;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = '.vercel/output/config.json';
  fs.writeFileSync(file,JSON.stringify(hardenBuildRoutes(JSON.parse(fs.readFileSync(file))),null,2)+'\n');
  console.log('Build redirects reject protocol-relative and backslash destinations.');
}
