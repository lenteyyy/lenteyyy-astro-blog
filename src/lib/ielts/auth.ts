import type { AstroCookies } from 'astro';
import type { Session, User } from '@supabase/supabase-js';
import { isAdminEmail } from './config';
import { createPublicClient, createServiceClient } from './supabase';
import { claimRateLimit } from './security';

// __Host- prevents an unrelated subdomain from injecting authentication cookies.
export const authCookieNames = () => import.meta.env.PROD
	? { access: '__Host-ielts_access', refresh: '__Host-ielts_refresh' }
	: { access: 'ielts_access', refresh: 'ielts_refresh' };

const cookieOptions = (maxAge: number) => ({
	httpOnly: true,
	secure: import.meta.env.PROD,
	sameSite: 'strict' as const,
	path: '/',
	maxAge,
});

export const setAuthSession = (cookies: AstroCookies, session: Session) => {
	const names = authCookieNames();
	cookies.set(names.access, session.access_token, cookieOptions(Math.max(60, session.expires_in - 30)));
	cookies.set(names.refresh, session.refresh_token, cookieOptions(60 * 60 * 24 * 30));
	if (import.meta.env.PROD) for (const name of ['ielts_access', 'ielts_refresh']) cookies.delete(name, { path: '/', secure: true });
};

export const clearAuthSession = (cookies: AstroCookies) => {
	const names = authCookieNames();
	for (const name of [names.access, names.refresh]) cookies.delete(name, { path: '/', secure: import.meta.env.PROD });
};

// Shape/size checks are not authentication; the provider verifies signatures.
const invalidAuthTokens = (access?: string, refresh?: string): boolean => Boolean(
	(access && (access.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(access)))
	|| (refresh && (refresh.length > 512 || !/^[A-Za-z0-9_-]+$/.test(refresh))),
);

export async function revokeAuthSession(cookies: AstroCookies, request?: Request): Promise<void> {
	const names = authCookieNames();
	let token = cookies.get(names.access)?.value;
	const refresh = cookies.get(names.refresh)?.value;
	if (!token && !refresh) return;
	if (invalidAuthTokens(token, refresh)) return;
	if (request && !(await claimRateLimit(request, 'session-logout-ip', '', 30, 60, 'request'))) throw new Error('rate_limited');
	const client = createPublicClient();
	const verified = token ? await client.auth.getUser(token) : undefined;
	if (!verified?.data.user) {
		if (!refresh) return;
		const result = await client.auth.refreshSession({ refresh_token: refresh });
		if (result.error) throw new Error('logout_unavailable');
		token = result.data.session?.access_token;
		if (!token) throw new Error('logout_unavailable');
	}
	if (token) {
		const result = await createServiceClient().auth.admin.signOut(token, 'local');
		if (result.error) throw new Error('logout_unavailable');
	}
}

export type AuthContext = { user: User; email: string; role: 'student' | 'admin' };

export async function getAuthContext(cookies: AstroCookies, request?: Request): Promise<AuthContext | undefined> {
	const names = authCookieNames();
	let accessToken = cookies.get(names.access)?.value;
	const refreshToken = cookies.get(names.refresh)?.value;
	if (!accessToken && !refreshToken) return undefined;
	if (invalidAuthTokens(accessToken, refreshToken)) {
		clearAuthSession(cookies);
		return undefined;
	}
	if (request && !(await claimRateLimit(request, 'session-check-ip', '', 600, 60, 'request'))) throw new Error('rate_limited');
	const client = createPublicClient();
	let user: User | undefined;
	if (accessToken) {
		const result = await client.auth.getUser(accessToken);
		user = result.data.user || undefined;
	}
	if (!user) {
		if (!refreshToken) return undefined;
		const refreshed = await client.auth.refreshSession({ refresh_token: refreshToken });
		if (!refreshed.data.session || !refreshed.data.user) {
			clearAuthSession(cookies);
			return undefined;
		}
		setAuthSession(cookies, refreshed.data.session);
		user = refreshed.data.user;
		accessToken = refreshed.data.session.access_token;
	}
	const email = user.email?.trim().toLowerCase();
	if (!email || !accessToken || !user.email_confirmed_at) {
		clearAuthSession(cookies);
		return undefined;
	}
	const role = isAdminEmail(email) ? 'admin' : 'student';
	// The auth.users trigger maintains profiles. Read requests must not upsert
	// profiles; privileges are derived from the verified email, never profile input.
	return { user, email, role };
}
