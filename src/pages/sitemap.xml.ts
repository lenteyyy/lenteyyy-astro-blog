import type { APIRoute } from 'astro';
import { getPosts, getTags } from '../lib/posts';
import { canonicalUrl } from '../lib/site';

const escapeXml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character] || character);

export const GET: APIRoute = async () => {
	const posts = await getPosts();
	const tags = await getTags();
	const categories = [...new Set(posts.map((post) => post.category))];
	const urls: Array<{ loc: string; priority: string; lastmod?: string }> = [
		{ loc: canonicalUrl('/'), priority: '1.0' },
		{ loc: canonicalUrl('/posts'), priority: '0.8' },
		{ loc: canonicalUrl('/about'), priority: '0.5' },
		{ loc: canonicalUrl('/zh-tw'), priority: '1.0' },
		{ loc: canonicalUrl('/zh-tw/posts'), priority: '0.8' },
		{ loc: canonicalUrl('/zh-tw/about'), priority: '0.5' },
		...posts.map((post) => ({ loc: canonicalUrl(`/posts/${post.slug}`), lastmod: post.updatedAt, priority: '0.7' })),
		...posts.map((post) => ({ loc: canonicalUrl(`/zh-tw/posts/${post.slug}`), lastmod: post.updatedAt, priority: '0.7' })),
		...categories.map((category) => ({ loc: canonicalUrl(`/posts/category/${encodeURIComponent(category)}`), priority: '0.5' })),
		...categories.map((category) => ({ loc: canonicalUrl(`/zh-tw/posts/category/${encodeURIComponent(category)}`), priority: '0.5' })),
		...tags.map(({ tag }) => ({ loc: canonicalUrl(`/tags/${encodeURIComponent(tag)}`), priority: '0.4' })),
		...tags.map(({ tag }) => ({ loc: canonicalUrl(`/zh-tw/tags/${encodeURIComponent(tag)}`), priority: '0.4' })),
	];
	const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((item) => `<url><loc>${escapeXml(item.loc)}</loc>${item.lastmod ? `<lastmod>${escapeXml(item.lastmod)}</lastmod>` : ''}<priority>${item.priority}</priority></url>`).join('')}</urlset>`;
	return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
