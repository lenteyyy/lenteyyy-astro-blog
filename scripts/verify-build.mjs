import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { field, splitFrontmatter } from './content-utils.mjs';

const project = process.cwd();
const postsDir = path.join(project, 'content', 'posts');
const buildDir = path.join(project, 'dist', 'client');
const mediaDir = path.join(project, 'public', 'media');
const failures = [];
const files = (await readdir(postsDir)).filter((name) => name.endsWith('.md')).sort();
const posts = [];

for (const name of files) {
	const source = await readFile(path.join(postsDir, name), 'utf8');
	const { data } = splitFrontmatter(source);
	posts.push({ slug: String(field(data, 'slug')), hasCover: Boolean(String(field(data, 'cover')).trim()) });
}

for (const { slug, hasCover } of posts) {
	for (const localePrefix of ['', 'zh-tw/']) {
		const articlePath = path.join(buildDir, localePrefix, 'posts', slug, 'index.html');
		let html = '';
		try { html = await readFile(articlePath, 'utf8'); } catch { failures.push(`${localePrefix}${slug}: article page is missing`); continue; }
		const content = html.match(/<div class="article-content"[\s\S]*?>([\s\S]*?)<\/div><script type="module" src="\/_astro\/ObsidianContent/)?.[1] || '';
		if (content.replace(/<[^>]+>/g, '').trim().length < 10) failures.push(`${localePrefix}${slug}: rendered body is empty`);
		if (content.includes('![[')) failures.push(`${localePrefix}${slug}: unresolved Obsidian image link`);
		if (/<script\b/i.test(content)) failures.push(`${localePrefix}${slug}: article body contains executable script`);
		if (!html.includes(`/api/og/${localePrefix}${slug}.png`)) failures.push(`${localePrefix}${slug}: dynamic OG metadata is missing`);
		if (!html.includes('data-view-counter')) failures.push(`${localePrefix}${slug}: view counter is missing`);
		if (!html.includes('data-share')) failures.push(`${localePrefix}${slug}: share control is missing`);
		if (hasCover && !html.includes('class="hero-image"')) failures.push(`${localePrefix}${slug}: cover image is missing`);
		if (localePrefix && /回复|回復/.test(content)) failures.push(`${localePrefix}${slug}: Taiwan wording still contains 回复/回復`);
		for (const gallery of content.matchAll(/<div class="image-gallery[^">]*">([\s\S]*?)<\/div>/g)) {
			const remainder = gallery[1]
				.replace(/<figure class="article-image"><img [^>]*\/><figcaption>[\s\S]*?<\/figcaption><\/figure>\s*/g, '')
				.replace(/<figure class="article-image"><img [^>]*\/><\/figure>\s*/g, '')
				.trim();
			if (remainder) failures.push(`${localePrefix}${slug}: gallery contains non-image content`);
		}
		for (const match of content.matchAll(/(?:src|href)="(\/media\/[a-f0-9]+\.webp)"/g)) {
			try { await stat(path.join(project, 'public', match[1])); } catch { failures.push(`${localePrefix}${slug}: missing ${match[1]}`); }
		}
	}
	const ogFiles = [
		path.join(buildDir, 'api', 'og', `${slug}.png`),
		path.join(buildDir, 'api', 'og', 'zh-tw', `${slug}.png`),
	];
	for (const ogPath of ogFiles) {
		try {
			const image = await readFile(ogPath);
			if (image.length < 10_000 || image.subarray(1, 4).toString() !== 'PNG') failures.push(`${slug}: invalid OG PNG`);
		} catch { failures.push(`${slug}: OG PNG is missing`); }
	}
}

const sitemap = await readFile(path.join(buildDir, 'sitemap.xml'), 'utf8');
const rss = await readFile(path.join(buildDir, 'rss.xml'), 'utf8');
const twRss = await readFile(path.join(buildDir, 'zh-tw', 'rss.xml'), 'utf8');
for (const { slug } of posts) {
	if (!sitemap.includes(`/posts/${slug}`) || !sitemap.includes(`/zh-tw/posts/${slug}`)) failures.push(`${slug}: sitemap entry is missing`);
	if (!rss.includes(`/posts/${slug}`) || !twRss.includes(`/zh-tw/posts/${slug}`)) failures.push(`${slug}: RSS entry is missing`);
}

const mainTraditionalSample = await readFile(path.join(buildDir, 'posts', 'pai-weijun-whatever-u-want', 'index.html'), 'utf8');
if (!mainTraditionalSample.includes('不錯，這張專輯也是發佈了呢')) failures.push('main site did not preserve native Traditional Chinese source');
const gallerySample = await readFile(path.join(buildDir, 'posts', 'september-fashion-finds', 'index.html'), 'utf8');
if (!gallerySample.includes('image-gallery-2')) failures.push('adjacent image gallery rendering is missing');
const embedSample = await readFile(path.join(buildDir, 'posts', 'pai-weijun-bad-idea', 'index.html'), 'utf8');
for (const host of ['youtube-nocookie.com/embed', 'open.spotify.com/embed', 'embed.music.apple.com']) {
	if (!embedSample.includes(host)) failures.push(`media embed is missing: ${host}`);
}

const manifest = JSON.parse(await readFile(path.join(project, 'content', 'media-manifest.json'), 'utf8'));
const mediaFiles = (await readdir(mediaDir)).filter((name) => name.endsWith('.webp'));
if (new Set(Object.values(manifest)).size !== mediaFiles.length) failures.push('media manifest and generated media count differ');

if (failures.length) {
	console.error(failures.join('\n'));
	process.exitCode = 1;
} else {
	console.log(`Verified ${posts.length * 2} article pages, ${posts.length * 2} OG images, RSS, sitemap, embeds, galleries, locale wording and ${mediaFiles.length} media files.`);
}
