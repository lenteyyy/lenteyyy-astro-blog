import type { APIRoute } from 'astro';
import { formatDisplayDate, getPostBySlug } from '../../../lib/posts';
import { canonicalUrl } from '../../../lib/site';

export const prerender = false;

const escapeXml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character] || character);

export const GET: APIRoute = async ({ params }) => {
	const post = await getPostBySlug(params.slug?.replace(/\.svg$/, '') || '');
	if (!post) return new Response('Not found', { status: 404 });
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#191613"/><stop offset="1" stop-color="#30251f"/></linearGradient></defs><rect width="1200" height="630" fill="url(#paper)"/><rect x="58" y="58" width="1084" height="514" fill="none" stroke="#8f8378" stroke-opacity=".45"/><image href="${escapeXml(canonicalUrl('/assets/lenteyyy-logo.png'))}" x="76" y="76" width="92" height="92" preserveAspectRatio="xMidYMid slice"/><text x="1038" y="112" text-anchor="end" fill="#cda095" font-family="Arial, sans-serif" font-size="22" letter-spacing="4">LENTEYYY</text><text x="104" y="270" fill="#efe9df" font-family="Georgia, serif" font-size="56" font-weight="600">${escapeXml(post.title)}</text><line x1="104" y1="324" x2="1096" y2="324" stroke="#9d4a3d" stroke-width="2"/><text x="104" y="385" fill="#c8bcb0" font-family="Arial, sans-serif" font-size="25" letter-spacing="2">${escapeXml(formatDisplayDate(post.publishedAt))}  ·  ${escapeXml(post.category)}</text><text x="104" y="510" fill="#9f958b" font-family="Arial, sans-serif" font-size="20" letter-spacing="3">LENTEYYY BLOG</text></svg>`;
	return new Response(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=86400' } });
};
