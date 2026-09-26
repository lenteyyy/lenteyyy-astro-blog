import type { APIRoute } from 'astro';
import { clearAuthSession } from '../../../../lib/ielts/auth';
import { json, sameOrigin } from '../../../../lib/ielts/http';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
	clearAuthSession(cookies);
	return json({ ok: true });
};
