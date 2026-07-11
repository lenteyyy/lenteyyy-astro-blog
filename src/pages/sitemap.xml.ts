import type { APIRoute } from 'astro';
import { getPosts, getTags } from '../lib/posts';
import { canonicalUrl } from '../lib/site';

export const GET: APIRoute = async () => {
	const posts = await getPosts();
	const tags = await getTags();
	const urls: Array<{ loc: string; priority: string; lastmod?: string }> = [
		{ loc: canonicalUrl('/'), priority: '1.0' },
		{ loc: canonicalUrl('/posts'), priority: '0.8' },
		{ loc: canonicalUrl('/about'), priority: '0.5' },
		...posts.map((post) => ({ loc: canonicalUrl(`/posts/${post.slug}`), lastmod: post.updatedAt, priority: '0.7' })),
		...tags.map(({ tag }) => ({ loc: canonicalUrl(`/tags/${encodeURIComponent(tag)}`), priority: '0.4' })),
	];
	const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((item) => `<url><loc>${item.loc}</loc>${item.lastmod ? `<lastmod>${item.lastmod}</lastmod>` : ''}<priority>${item.priority}</priority></url>`).join('')}</urlset>`;
	return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
