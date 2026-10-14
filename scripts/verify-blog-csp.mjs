import fs from 'node:fs';import path from 'node:path';
const policy=JSON.parse(fs.readFileSync('vercel.json')).headers.find(r=>r.source==='/(.*)').headers.find(h=>h.key==='Content-Security-Policy').value;
const scripts=policy.split(';').find(value=>value.trim().startsWith('script-src'));
if(scripts.includes("'unsafe-inline'")||scripts.includes("'unsafe-eval'"))throw Error('Blog executable script policy must remain strict');
let pages=0;
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const file=path.join(dir,entry.name);if(entry.isDirectory()){walk(file);continue;}if(!file.endsWith('.html'))continue;
 pages++;const html=fs.readFileSync(file,'utf8');
 for(const [,attributes,body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(/\bsrc\s*=/i.test(attributes))continue;
  if(/\btype\s*=\s*["']application\/(?:ld\+)?json["']/i.test(attributes)){JSON.parse(body);continue;}
  throw Error('Executable inline script in '+file);
 }
 if(/<[a-z][^>]*\son[a-z]+\s*=/i.test(html))throw Error('Inline event handler in '+file);
}}
walk('dist/client');console.log(`Strict blog CSP verified: ${pages} pages, no executable inline scripts or event handlers.`);
