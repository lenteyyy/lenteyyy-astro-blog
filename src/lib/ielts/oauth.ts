import type { AstroCookies } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { ieltsConfig } from './config';
import { OAUTH_STORAGE_KEY, OAUTH_TTL_SECONDS, oauthMemoryStorage, type OAuthPending } from './oauth-policy';

// Host-only cookies cannot be overwritten by another subdomain in production.
export const oauthCookieName = () => import.meta.env.PROD ? '__Host-ielts_google' : 'ielts_google';

export function clearOAuthPending(cookies: AstroCookies) {
	cookies.delete(oauthCookieName(), { path: '/', secure: import.meta.env.PROD });
}

export function saveOAuthPending(cookies: AstroCookies, pending: OAuthPending) {
	const value = JSON.stringify(pending);
	if (value.length > 3500) throw new Error('invalid_oauth_storage');
	cookies.set(oauthCookieName(), value, { httpOnly: true, secure: import.meta.env.PROD, sameSite: 'lax', path: '/', maxAge: OAUTH_TTL_SECONDS });
}

export function createOAuthClient(initial: Record<string, string> = {}) {
	const config = ieltsConfig();
	const storage = oauthMemoryStorage(initial);
	const client = createClient(config.supabaseUrl, config.publicKey, {
		auth: { flowType: 'pkce', storageKey: OAUTH_STORAGE_KEY, storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
	});
	return { client, storage, supabaseUrl: config.supabaseUrl };
}
