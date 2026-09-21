import { access, cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { field, serializePost, splitFrontmatter, titleFromFile } from './content-utils.mjs';

const vault = process.argv[2];
if (!vault) throw new Error('Usage: node scripts/import-obsidian.mjs /absolute/path/to/vault');

const databaseDir = path.join(vault, 'Notion', '欢迎你来到Lenteyyy的个人博客！', 'Astro Blog Posts');
const sourceDir = path.dirname(databaseDir);
const project = process.cwd();
const postsDir = path.join(project, 'content', 'posts');
const attachmentsDir = path.join(project, 'content', '_attachments');
const oldAttachments = path.join(vault, '_attachments');

await mkdir(postsDir, { recursive: true });
await mkdir(attachmentsDir, { recursive: true });
await cp(oldAttachments, attachmentsDir, { recursive: true, force: false, errorOnExist: false });

const files = (await readdir(databaseDir)).filter((name) => name.endsWith('.md')).sort();
const slugs = new Set();

for (const name of files) {
	const databasePath = path.join(databaseDir, name);
	const database = splitFrontmatter(await readFile(databasePath, 'utf8'));
	let body = database.body;
	let sourceData = {};
	if (field(database.data, 'SourcePage')) {
		const sourcePath = path.join(sourceDir, name);
		try {
			await access(sourcePath);
			const source = splitFrontmatter(await readFile(sourcePath, 'utf8'));
			body = source.body;
			sourceData = source.data;
		} catch {
			// Notion exports relationship properties even when the article body is already on the database page.
		}
	}
	const title = titleFromFile(name);
	const slug = String(field(database.data, 'Slug')).trim();
	if (!slug || slugs.has(slug)) throw new Error(`Missing or duplicate slug: ${name}`);
	if (!body.trim()) throw new Error(`Published article has no body: ${name}`);
	slugs.add(slug);

	let cover = String(field(sourceData, 'cover', field(database.data, 'cover', field(database.data, 'Cover', ''))));
	if (slug === 'ibuki-idom-slide-like-this' && cover.includes('IBUKI , idom')) cover = '[[slide-like-this-cover.png]]';
	const tags = field(database.data, 'Tags', []);
	const status = String(field(database.data, 'Status', 'Published')).toLowerCase() === 'published' ? 'published' : 'draft';
	const post = {
		title,
		slug,
		date: String(field(database.data, 'Date')),
		category: String(field(database.data, 'Category', '个人杂谈')),
		tags: Array.isArray(tags) ? tags : [tags].filter(Boolean),
		status,
		summary: String(field(database.data, 'Summary', '')),
		cover,
		featured: Boolean(field(database.data, 'Featured', false)),
	};
	await writeFile(path.join(postsDir, `${slug}.md`), serializePost(post, body), 'utf8');
}

console.log(`Imported ${files.length} published posts and copied the local attachment library.`);
