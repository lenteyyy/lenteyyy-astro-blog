import type { APIRoute } from 'astro';
import { json, readJson, sameOrigin } from '../../../../../lib/ielts/http';
import { claimRateLimit } from '../../../../../lib/ielts/security';
import { clearOAuthPending, createOAuthClient, saveOAuthPending } from '../../../../../lib/ielts/oauth';
import { OAUTH_CALLBACK_PATH, oauthOrigin, safeIeltsNext, validGoogleAuthorizationUrl } from '../../../../../lib/ielts/oauth-policy';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
	try {
		const origin = oauthOrigin(request.url, import.meta.env.PROD);
		const body = await readJson<{ next?: unknown }>(request);
		if (!(await claimRateLimit(request, 'google-login-ip', '', 20, 900, 'request'))) return json({ error: 'rate_limited' }, 429, { 'retry-after': '900' });
		clearOAuthPending(cookies);
		const state = [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('');
		const callback = new URL(OAUTH_CALLBACK_PATH, origin);
		callback.searchParams.set('state', state);
		const { client, storage, supabaseUrl } = createOAuthClient();
		const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback.href, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } } });
		if (error || !data.url || !validGoogleAuthorizationUrl(data.url, supabaseUrl)) return json({ error: 'google_login_unavailable' }, 503);
		saveOAuthPending(cookies, { state, createdAt: Date.now(), next: safeIeltsNext(body.next), storage: storage.pkceSnapshot() });
		return json({ url: data.url });
	} catch {
		clearOAuthPending(cookies);
		return json({ error: 'google_login_unavailable' }, 503);
	}
};
