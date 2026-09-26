import type { APIRoute } from 'astro';
import { sendLoginCode } from '../../../../lib/ielts/email';
import { json, normalizeEmail, readJson, sameOrigin } from '../../../../lib/ielts/http';
import { claimRateLimit } from '../../../../lib/ielts/security';
import { createServiceClient } from '../../../../lib/ielts/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
	try {
		const body = await readJson<{ email?: unknown }>(request);
		const email = normalizeEmail(body.email);
		if (!email) return json({ error: 'invalid_email' }, 400);
		if (!(await claimRateLimit(request, 'otp-ip', '', 20, 3600)) || !(await claimRateLimit(request, 'otp-email', email, 5, 900))) {
			return json({ error: 'rate_limited' }, 429, { 'retry-after': '900' });
		}
		const { data, error } = await createServiceClient().auth.admin.generateLink({ type: 'magiclink', email });
		const code = data?.properties?.email_otp;
		if (error || !code) throw new Error('otp_generation_failed');
		await sendLoginCode(email, code);
		return json({ ok: true }, 202);
	} catch (error) {
		if (error instanceof Error && ['invalid_content_type', 'payload_too_large'].includes(error.message)) return json({ error: error.message }, 400);
		return json({ error: 'verification_unavailable' }, 503);
	}
};
