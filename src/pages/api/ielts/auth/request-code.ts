import type { APIRoute } from 'astro';
import { sendLoginCode } from '../../../../lib/ielts/email';
import { ieltsConfig } from '../../../../lib/ielts/config';
import { json, normalizeEmail, readJson, sameOrigin } from '../../../../lib/ielts/http';
import { claimRateLimit, createSixDigitCode, sha256, verificationHash } from '../../../../lib/ielts/security';
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
		const code = createSixDigitCode();
		const emailHash = await sha256(email);
		const codeHash = await verificationHash(email, code, ieltsConfig().secretKey);
		const client = createServiceClient();
		await client.from('ielts_verification_codes').delete().lt('expires_at', new Date().toISOString());
		const { error } = await client.from('ielts_verification_codes').upsert({
			email_hash: emailHash,
			code_hash: codeHash,
			expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
			attempts: 0,
			created_at: new Date().toISOString(),
		}, { onConflict: 'email_hash' });
		if (error) throw error;
		try { await sendLoginCode(email, code); }
		catch (error) { await client.from('ielts_verification_codes').delete().eq('email_hash', emailHash); throw error; }
		return json({ ok: true }, 202);
	} catch (error) {
		if (error instanceof Error && ['invalid_content_type', 'payload_too_large'].includes(error.message)) return json({ error: error.message }, 400);
		return json({ error: 'verification_unavailable' }, 503);
	}
};
