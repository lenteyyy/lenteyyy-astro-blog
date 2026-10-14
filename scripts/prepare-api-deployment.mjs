import fs from 'node:fs';import path from 'node:path';import{createHash}from'node:crypto';
const link=JSON.parse(fs.readFileSync('.vercel/project.json'));
const known=new Set(JSON.parse(fs.readFileSync('.vercel/uploaded-manifest.json')).map(x=>x.sha));
const paths=[];const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){if(e.name.startsWith('.')||e.name.endsWith('.log'))continue;const file=path.posix.join(d,e.name);if(e.isDirectory())walk(file);else if(e.isFile())paths.push(file);}};
for(const d of ['src','public','scripts','tests','infra','content/posts'])if(fs.existsSync(d))walk(d);
for(const file of ['.vercelignore','README.md','astro.config.mjs','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','vercel.json','content/media-manifest.json'])if(fs.existsSync(file))paths.push(file);
const hashes=[],files=paths.sort().map(file=>{const bytes=fs.readFileSync(file),sha=createHash('sha1').update(bytes).digest('hex');hashes.push({file,sha,size:bytes.length});if(known.has(sha))return{file,sha,size:bytes.length};if(bytes.length>10_000_000)throw Error('New large asset needs upload first: '+file);return{file,data:bytes.toString('base64'),encoding:'base64'};});
const body={name:link.projectName,project:link.projectId,target:'production',files,projectSettings:{framework:'astro',nodeVersion:'24.x'}};fs.writeFileSync('.vercel/independent-release.json',JSON.stringify(body));fs.writeFileSync('.vercel/independent-manifest.json',JSON.stringify(hashes));
console.log(JSON.stringify({project:link.projectName,id:link.projectId,files:files.length,inline:files.filter(x=>x.data).length,bodyBytes:fs.statSync('.vercel/independent-release.json').size}));
