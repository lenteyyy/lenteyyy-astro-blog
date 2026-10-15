import fs from 'node:fs';import {deploymentFiles} from './deployment-files.mjs';import{createHash}from'node:crypto';
import {verifyDeploymentTarget} from './verify-deployment-target.mjs';
const link=verifyDeploymentTarget(process.cwd(),true);
const known=new Set(JSON.parse(fs.readFileSync('.vercel/uploaded-manifest.json')).map(x=>x.sha));
const paths=deploymentFiles();
const hashes=[],files=paths.sort().map(file=>{const bytes=fs.readFileSync(file),sha=createHash('sha1').update(bytes).digest('hex');hashes.push({file,sha,size:bytes.length});if(known.has(sha))return{file,sha,size:bytes.length};if(bytes.length>10_000_000)throw Error('New large asset needs upload first: '+file);return{file,data:bytes.toString('base64'),encoding:'base64'};});
const body={name:link.projectName,project:link.projectId,target:'production',files,projectSettings:{framework:'astro',nodeVersion:'24.x'}};fs.writeFileSync('.vercel/independent-release.json',JSON.stringify(body));fs.writeFileSync('.vercel/independent-manifest.json',JSON.stringify(hashes));
for(const file of ['.vercel/independent-release.json','.vercel/independent-manifest.json'])fs.chmodSync(file,0o600);
console.log(JSON.stringify({project:link.projectName,id:link.projectId,files:files.length,inline:files.filter(x=>x.data).length,bodyBytes:fs.statSync('.vercel/independent-release.json').size}));
