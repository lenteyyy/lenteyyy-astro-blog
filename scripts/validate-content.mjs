import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { field, splitFrontmatter, wikiReferences } from './content-utils.mjs';

const project = process.cwd();
const postsDir = path.join(project, 'content', 'posts');
const manifest = JSON.parse(await readFile(path.join(project, 'content', 'media-manifest.json'), 'utf8'));
const allowedCategories = new Set(['酒店测评', '音乐推荐', '个人杂谈', '时尚议论']);
const slugs = new Set();
const failures = [];

const files = (await readdir(postsDir)).filter((name) => name.endsWith('.md')).sort();
for (const name of files) {
	const source = await readFile(path.join(postsDir, name), 'utf8');
	const { data, body } = splitFrontmatter(source);
	const title = String(field(data, 'title')).trim();
	const slug = String(field(data, 'slug')).trim();
	const date = String(field(data, 'date')).trim();
	const category = String(field(data, 'category')).trim();
	const status = String(field(data, 'status')).trim();
	if (!title || !slug || !date || !category) failures.push(`${name}: required metadata is incomplete`);
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) failures.push(`${name}: invalid slug ${slug}`);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) failures.push(`${name}: invalid date ${date}`);
	if (!allowedCategories.has(category)) failures.push(`${name}: unsupported category ${category}`);
	if (status !== 'published') failures.push(`${name}: content/posts only accepts published articles`);
	if (slugs.has(slug)) failures.push(`${name}: duplicate slug ${slug}`);
	slugs.add(slug);
	if (!body.trim()) failures.push(`${name}: body is empty`);
	if (/^(?:notion-id|SourcePage|base):/mi.test(source)) failures.push(`${name}: legacy Notion metadata remains`);
	if (/\/Users\/|(?:NOTION|VERCEL|GITHUB)_[A-Z_]*TOKEN\s*=|\b(?:gh[op]|sk)-[A-Za-z0-9_-]{12,}/.test(source)) failures.push(`${name}: possible local path or secret`);
	for (const ref of wikiReferences(source)) if (!manifest[ref]) failures.push(`${name}: missing media manifest entry for ${ref}`);
}

for (const [ref, url] of Object.entries(manifest)) {
	const file = path.join(project, 'public', url.replace(/^\//, ''));
	try {
		const metadata = await sharp(file).metadata();
		if (metadata.exif || metadata.iptc || metadata.xmp) failures.push(`${ref}: published media still contains metadata`);
	} catch (error) {
		failures.push(`${ref}: published media is unreadable`);
	}
}

if (failures.length) {
	console.error(failures.join('\n'));
	process.exitCode = 1;
} else {
	console.log(`Validated ${files.length} published posts, ${Object.keys(manifest).length} media references, unique slugs, privacy and metadata stripping.`);
}
