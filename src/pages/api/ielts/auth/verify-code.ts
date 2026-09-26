import type { APIRoute } from 'astro';
import { setAuthSession } from '../../../../lib/ielts/auth';
import { ieltsConfig } from '../../../../lib/ielts/config';
import { json, normalizeEmail, readJson, sameOrigin } from '../../../../lib/ielts/http';
import { claimRateLimit, constantTimeEqual, sha256, verificationHash } from '../../../../lib/ielts/security';
import { createPublicClient, createServiceClient } from '../../../../lib/ielts/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
	try {
		const body = await readJson<{ email?: unknown; code?: unknown; password?: unknown }>(request);
		const email = normalizeEmail(body.email);
		const code = String(body.code || '').trim();
		const password = String(body.password || '');
		if (!email || !/^\d{6}$/.test(code)) return json({ error: 'invalid_code' }, 400);
		if (password.length < 10 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return json({ error: 'invalid_password' }, 400);
		if (!(await claimRateLimit(request, 'otp-verify-email', email, 10, 900, 'identity'))
			|| !(await claimRateLimit(request, 'otp-verify-ip', '', 30, 900, 'request'))) return json({ error: 'rate_limited' }, 429, { 'retry-after': '900' });
		const client = createServiceClient();
		const emailHash = await sha256(email);
		const { data: challenge, error: challengeError } = await client.from('ielts_verification_codes')
			.select('code_hash, expires_at, attempts')
			.eq('email_hash', emailHash)
			.maybeSingle();
		if (challengeError) throw challengeError;
		const expected = await verificationHash(email, code, ieltsConfig().secretKey);
		if (!challenge || challenge.attempts >= 5 || new Date(challenge.expires_at).getTime() < Date.now() || !constantTimeEqual(challenge.code_hash, expected)) {
			if (challenge) await client.from('ielts_verification_codes').update({ attempts: Math.min(10, challenge.attempts + 1) }).eq('email_hash', emailHash);
			return json({ error: 'invalid_code' }, 401);
		}
		await client.from('ielts_verification_codes').delete().eq('email_hash', emailHash);
		let existing: Awaited<ReturnType<typeof client.auth.admin.listUsers>>['data']['users'][number] | undefined;
		for (let page = 1; page <= 20 && !existing; page += 1) {
			const listed = await client.auth.admin.listUsers({ page, perPage: 1000 });
			if (listed.error) throw listed.error;
			existing = listed.data.users.find((user) => user.email?.trim().toLowerCase() === email);
			if (listed.data.users.length < 1000) break;
		}
		const account = existing
			? await client.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
			: await client.auth.admin.createUser({ email, password, email_confirm: true });
		if (account.error) throw account.error;
		const { data, error } = await createPublicClient().auth.signInWithPassword({ email, password });
		if (error || !data.session || !data.user) return json({ error: 'login_unavailable' }, 503);
		setAuthSession(cookies, data.session);
		return json({ ok: true, email: data.user.email });
	} catch (error) {
		if (error instanceof Error && ['invalid_content_type', 'payload_too_large'].includes(error.message)) return json({ error: error.message }, 400);
		return json({ error: 'account_unavailable' }, 503);
	}
};
