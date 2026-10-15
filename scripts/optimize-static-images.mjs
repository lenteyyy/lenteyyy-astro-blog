import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// Re-encode PNGs losslessly; retain the original if size or decoded pixels regress.
export async function optimizePngFiles(folders) {
  const files=[];
  const walk=folder=>{if(!fs.existsSync(folder))return;for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory())walk(file);else if(entry.isFile()&&file.endsWith('.png'))files.push(file);}};
  folders.forEach(walk);let before=0,after=0,optimized=0;
  for(const file of files){const original=fs.readFileSync(file);before+=original.length;let next=original;const candidate=await sharp(original).png({compressionLevel:9,adaptiveFiltering:true,effort:10}).toBuffer();
    if(candidate.length<original.length){const a=await sharp(original).raw().toBuffer({resolveWithObject:true});const b=await sharp(candidate).raw().toBuffer({resolveWithObject:true});if(a.info.width===b.info.width&&a.info.height===b.info.height&&a.info.channels===b.info.channels&&a.data.equals(b.data)){next=candidate;fs.writeFileSync(file,next);optimized++;}}
    after+=next.length;
  }
  return {files:files.length,optimized,before,after,saved:before-after};
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname){console.log(JSON.stringify(await optimizePngFiles(process.argv.length>2?process.argv.slice(2):['dist/client','.vercel/output/static'])));}
