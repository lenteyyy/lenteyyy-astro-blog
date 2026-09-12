import type { APIRoute } from 'astro';
import { blocksToPlainText, escapeHtml, getPosts } from '../../lib/posts';
import { translateText } from '../../lib/locale';
import { canonicalUrl, site } from '../../lib/site';

export const GET: APIRoute = async () => {
	const posts = await getPosts();
	const items = posts.map((post) => {
		const url = canonicalUrl(`/zh-tw/posts/${post.slug}`);
		const description = translateText(post.description || blocksToPlainText(post.content).slice(0, 180), 'zh-TW');
		return `<item><title>${escapeHtml(translateText(post.title, 'zh-TW'))}</title><link>${escapeHtml(url)}</link><guid>${escapeHtml(url)}</guid><pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate><description>${escapeHtml(description)}</description></item>`;
	}).join('');
	const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeHtml(translateText(site.title, 'zh-TW'))}</title><link>${escapeHtml(canonicalUrl('/zh-tw'))}</link><description>${escapeHtml(translateText(site.description, 'zh-TW'))}</description>${items}</channel></rss>`;
	return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
};
