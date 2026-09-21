import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { wikiReferences } from './content-utils.mjs';

const project = process.cwd();
const postsDir = path.join(project, 'content', 'posts');
const attachmentsDir = path.join(project, 'content', '_attachments');
const outputDir = path.join(project, 'public', 'media');
const manifestPath = path.join(project, 'content', 'media-manifest.json');
const processingVersion = 'webp-v1-2400-q84';

async function markdownFiles(directory) {
	const result = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const full = path.join(directory, entry.name);
		if (entry.isDirectory()) result.push(...await markdownFiles(full));
		else if (entry.name.endsWith('.md')) result.push(full);
	}
	return result;
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
const references = new Set();
for (const file of await markdownFiles(postsDir)) {
	for (const ref of wikiReferences(await readFile(file, 'utf8'))) references.add(ref);
}

const sourceFiles = await readdir(attachmentsDir);
const sourceMap = new Map(sourceFiles.map((name) => [name, path.join(attachmentsDir, name)]));
const extensionlessSourceMap = new Map();
for (const name of sourceFiles) {
	const key = path.basename(name, path.extname(name));
	if (!extensionlessSourceMap.has(key)) extensionlessSourceMap.set(key, path.join(attachmentsDir, name));
}
const manifest = {};
let outputBytes = 0;

for (const ref of [...references].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))) {
	const source = sourceMap.get(ref) || extensionlessSourceMap.get(ref);
	if (!source) throw new Error(`Missing Obsidian attachment: ${ref}`);
	const input = await readFile(source);
	const hash = createHash('sha256').update(processingVersion).update(input).digest('hex').slice(0, 20);
	const outputName = `${hash}.webp`;
	const output = path.join(outputDir, outputName);
	try {
		const rendered = await sharp(input, { failOn: 'error' })
			.rotate()
			.resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
			.webp({ quality: 84, effort: 4 })
			.toBuffer();
		await writeFile(output, rendered);
		outputBytes += (await stat(output)).size;
		manifest[ref] = `/media/${outputName}`;
	} catch (error) {
		throw new Error(`Cannot process attachment ${ref}: ${error instanceof Error ? error.message : String(error)}`);
	}
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Processed ${references.size} referenced images (${(outputBytes / 1024 / 1024).toFixed(1)} MB), with metadata removed.`);
