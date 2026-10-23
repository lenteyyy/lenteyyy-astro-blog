import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { field, splitFrontmatter, wikiReference, wikiReferences } from './content-utils.mjs';
import { postFiles } from './post-files.mjs';

const project = process.cwd();
const postsDir = path.join(project, 'content', 'posts');
const attachmentsDir = path.join(project, 'content', '_attachments');
const outputDir = path.join(project, 'public', 'media');
const manifestPath = path.join(project, 'content', 'media-manifest.json');
const processingVersion = 'webp-v1-2400-q84';

const references = new Set();
for (const file of await postFiles(postsDir)) {
	const source = await readFile(path.join(postsDir, file), 'utf8');
	const { data, body } = splitFrontmatter(source);
	for (const ref of wikiReferences(body)) references.add(ref);
	const cover = wikiReference(field(data, 'cover'));
	if (cover) references.add(cover);
}

if ((await lstat(attachmentsDir)).isSymbolicLink()) throw new Error('Attachment directory symlink rejected');
const sourceEntries = await readdir(attachmentsDir, { withFileTypes: true });
if (sourceEntries.some(entry => entry.isSymbolicLink())) throw new Error('Attachment symlink rejected');
const sourceFiles = sourceEntries.filter(entry => entry.isFile()).map(entry => entry.name);
const sourceMap = new Map(sourceFiles.map((name) => [name, path.join(attachmentsDir, name)]));
const extensionlessSourceMap = new Map();
for (const name of sourceFiles) {
	const key = path.basename(name, path.extname(name));
	if (!extensionlessSourceMap.has(key)) extensionlessSourceMap.set(key, path.join(attachmentsDir, name));
}
const manifest = {};
let outputBytes = 0;

// Build in an ignored staging directory. Missing/corrupt input must never
// erase the currently published assets or leave a half-written manifest.
await mkdir(path.join(project, '.astro'), { recursive: true });
const staging = await mkdtemp(path.join(project, '.astro', 'media-sync-'));
const nextOutput = path.join(staging, 'next');
const previousOutput = path.join(staging, 'previous');
await mkdir(nextOutput);
let preserveStaging = false;

try {

for (const ref of [...references].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))) {
	const source = sourceMap.get(ref) || extensionlessSourceMap.get(ref);
	if (!source) throw new Error(`Missing Obsidian attachment: ${ref}`);
	const input = await readFile(source);
	const hash = createHash('sha256').update(processingVersion).update(input).digest('hex').slice(0, 20);
	const outputName = `${hash}.webp`;
	const output = path.join(nextOutput, outputName);
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

const nextManifest = path.join(staging, 'manifest.json');
await writeFile(nextManifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
let backedUp = false;
let swapped = false;
try {
	try { await rename(outputDir, previousOutput); backedUp = true; }
	catch (error) { if (error.code !== 'ENOENT') throw error; }
	await rename(nextOutput, outputDir);
	swapped = true;
	await rename(nextManifest, manifestPath);
} catch (error) {
	try {
		if (swapped) await rm(outputDir, { recursive: true, force: true });
		if (backedUp) await rename(previousOutput, outputDir);
	} catch (rollbackError) {
		// Never delete the only remaining backup if the filesystem blocks recovery.
		preserveStaging = true;
		throw new AggregateError([error, rollbackError], `Media rollback needs manual recovery from ${staging}`);
	}
	throw error;
}
console.log(`Processed ${references.size} referenced images (${(outputBytes / 1024 / 1024).toFixed(1)} MB), with metadata removed.`);
} finally {
	if (!preserveStaging) await rm(staging, { recursive: true, force: true });
}
