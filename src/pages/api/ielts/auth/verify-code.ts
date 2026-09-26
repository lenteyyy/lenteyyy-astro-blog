import type { APIRoute } from 'astro';
import { setAuthSession } from '../../../../lib/ielts/auth';
import { json, normalizeEmail, readJson, sameOrigin } from '../../../../lib/ielts/http';
import { claimRateLimit } from '../../../../lib/ielts/security';
import { createPublicClient } from '../../../../lib/ielts/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
	try {
		const body = await readJson<{ email?: unknown; code?: unknown }>(request);
		const email = normalizeEmail(body.email);
		const code = String(body.code || '').trim();
		if (!email || !/^\d{8}$/.test(code)) return json({ error: 'invalid_code' }, 400);
		if (!(await claimRateLimit(request, 'otp-verify', email, 10, 900))) return json({ error: 'rate_limited' }, 429, { 'retry-after': '900' });
		const { data, error } = await createPublicClient().auth.verifyOtp({ email, token: code, type: 'email' });
		if (error || !data.session || !data.user) return json({ error: 'invalid_code' }, 401);
		setAuthSession(cookies, data.session);
		return json({ ok: true, email: data.user.email });
	} catch (error) {
		if (error instanceof Error && ['invalid_content_type', 'payload_too_large'].includes(error.message)) return json({ error: error.message }, 400);
		return json({ error: 'verification_unavailable' }, 503);
	}
};
