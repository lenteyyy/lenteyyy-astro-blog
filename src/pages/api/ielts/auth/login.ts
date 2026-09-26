import type { APIRoute } from 'astro';
import { setAuthSession } from '../../../../lib/ielts/auth';
import { json, normalizeEmail, readJson, sameOrigin } from '../../../../lib/ielts/http';
import { claimRateLimit } from '../../../../lib/ielts/security';
import { createPublicClient } from '../../../../lib/ielts/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
	try {
		const body = await readJson<{ email?: unknown; password?: unknown }>(request);
		const email = normalizeEmail(body.email);
		const password = String(body.password || '');
		if (!email || password.length < 1 || password.length > 72) return json({ error: 'invalid_credentials' }, 400);
		if (!(await claimRateLimit(request, 'password-login-email', email, 10, 900, 'identity'))
			|| !(await claimRateLimit(request, 'password-login-ip', '', 30, 900, 'request'))) return json({ error: 'rate_limited' }, 429, { 'retry-after': '900' });
		const { data, error } = await createPublicClient().auth.signInWithPassword({ email, password });
		if (error || !data.session || !data.user) return json({ error: 'invalid_credentials' }, 401);
		setAuthSession(cookies, data.session);
		return json({ ok: true, email: data.user.email });
	} catch (error) {
		if (error instanceof Error && ['invalid_content_type', 'payload_too_large'].includes(error.message)) return json({ error: error.message }, 400);
		return json({ error: 'login_unavailable' }, 503);
	}
};
