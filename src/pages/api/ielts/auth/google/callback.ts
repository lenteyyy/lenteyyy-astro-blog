import type { APIRoute } from 'astro';
import { setAuthSession } from '../../../../../lib/ielts/auth';
import { clearOAuthPending, createOAuthClient, oauthCookieName } from '../../../../../lib/ielts/oauth';
import { oauthOrigin, parseOAuthPending, safeIeltsNext } from '../../../../../lib/ielts/oauth-policy';
import { constantTimeEqual } from '../../../../../lib/ielts/security';

export const prerender = false;

const redirect = (path: string) => new Response(null, { status: 303, headers: {
	location: path, 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff',
} });

export const GET: APIRoute = async ({ request, cookies }) => {
	const pending = parseOAuthPending(cookies.get(oauthCookieName())?.value);
	// Consume even failed/cancelled flows. Codes and provider tokens never reach the client.
	clearOAuthPending(cookies);
	try {
		oauthOrigin(request.url, import.meta.env.PROD);
		const url = new URL(request.url);
		const state = url.searchParams.get('state') || '';
		const code = url.searchParams.get('code') || '';
		if (!pending || !constantTimeEqual(pending.state, state) || url.searchParams.has('error')
			|| !/^[a-zA-Z0-9_-]{16,256}$/.test(code)) return redirect('/ielts?login=1&auth_error=google');
		const flowId = url.searchParams.get('sb_flow_id');
		const { client } = createOAuthClient(pending.storage);
		const { data, error } = await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
		if (error || !data.session) return redirect('/ielts?login=1&auth_error=google');
		const verified = await client.auth.getUser(data.session.access_token);
		if (verified.error || !verified.data.user?.email || !verified.data.user.email_confirmed_at) return redirect('/ielts?login=1&auth_error=google');
		setAuthSession(cookies, data.session);
		return redirect(safeIeltsNext(pending.next));
	} catch { return redirect('/ielts?login=1&auth_error=google'); }
};
