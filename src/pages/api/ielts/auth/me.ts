import type { APIRoute } from 'astro';
import { getAuthContext } from '../../../../lib/ielts/auth';
import { json } from '../../../../lib/ielts/http';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
	try {
		const auth = await getAuthContext(cookies, request);
		return auth ? json({ authenticated: true, userId: auth.user.id, email: auth.email, role: auth.role }) : json({ authenticated: false });
	} catch {
		return json({ error: 'session_unavailable' }, 503);
	}
};
