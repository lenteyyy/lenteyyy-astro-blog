import type { APIRoute } from 'astro';
import { getPostBySlug } from '../../../lib/posts';

export const prerender = false;

const botPattern = /bot|crawler|spider|crawling|facebookexternalhit|preview|slurp|bingpreview/i;

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
	});
}

async function redis(command: unknown[]): Promise<any> {
	const url = import.meta.env.UPSTASH_REDIS_REST_URL;
	const token = import.meta.env.UPSTASH_REDIS_REST_TOKEN;
	if (!url || !token) throw new Error('Missing Redis env');
	const response = await fetch(url, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: JSON.stringify(command),
	});
	if (!response.ok) throw new Error('Redis request failed');
	return response.json();
}

export const GET: APIRoute = async ({ params, request }) => {
	const slug = params.slug || '';
	if (!/^[\p{Letter}\p{Number}-]{1,120}$/u.test(slug)) return json({ error: 'invalid_slug' }, 400);
	if (!(await getPostBySlug(slug))) return json({ error: 'not_found' }, 404);

	const key = `post:views:${slug}`;
	const shouldIncrement = new URL(request.url).searchParams.get('increment') === '1';
	const userAgent = request.headers.get('user-agent') || '';
	const purpose = request.headers.get('purpose') || request.headers.get('sec-purpose') || '';
	const isBot = botPattern.test(userAgent) || /prefetch|prerender/i.test(purpose);

	try {
		const result = shouldIncrement && !isBot ? await redis(['INCR', key]) : await redis(['GET', key]);
		const raw = result.result ?? 0;
		return json({ slug, views: Number(raw) || 0 });
	} catch {
		if (import.meta.env.PROD) return json({ slug, views: null, unavailable: true }, 200);
		return json({ error: 'views_unavailable' }, 503);
	}
};
