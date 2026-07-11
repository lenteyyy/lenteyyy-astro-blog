import type { APIRoute } from 'astro';
import { blocksToPlainText, escapeHtml, getPosts } from '../lib/posts';
import { canonicalUrl, site } from '../lib/site';

export const GET: APIRoute = async () => {
	const posts = await getPosts();
	const items = posts.map((post) => {
		const url = canonicalUrl(`/posts/${post.slug}`);
		const description = post.description || blocksToPlainText(post.content).slice(0, 180);
		return `<item><title>${escapeHtml(post.title)}</title><link>${url}</link><guid>${url}</guid><pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate><description>${escapeHtml(description)}</description></item>`;
	}).join('');
	const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeHtml(site.title)}</title><link>${site.url}</link><description>${escapeHtml(site.description)}</description>${items}</channel></rss>`;
	return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
};
