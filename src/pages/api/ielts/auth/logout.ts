import type { APIRoute } from 'astro';
import { clearAuthSession, revokeAuthSession } from '../../../../lib/ielts/auth';
import { json, sameOrigin } from '../../../../lib/ielts/http';
import { clearOAuthPending } from '../../../../lib/ielts/oauth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
	try {
		await revokeAuthSession(cookies, request);
		return json({ ok: true });
	} catch {
		return json({ error: 'logout_unavailable' }, 503);
	} finally {
		clearAuthSession(cookies);
		clearOAuthPending(cookies);
	}
};
