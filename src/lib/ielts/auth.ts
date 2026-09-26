import type { AstroCookies } from 'astro';
import type { Session, User } from '@supabase/supabase-js';
import { isAdminEmail } from './config';
import { createPublicClient, createServiceClient } from './supabase';

const accessCookie = 'ielts_access';
const refreshCookie = 'ielts_refresh';

const cookieOptions = (maxAge: number) => ({
	httpOnly: true,
	secure: import.meta.env.PROD,
	sameSite: 'strict' as const,
	path: '/',
	maxAge,
});

export const setAuthSession = (cookies: AstroCookies, session: Session) => {
	cookies.set(accessCookie, session.access_token, cookieOptions(Math.max(60, session.expires_in - 30)));
	cookies.set(refreshCookie, session.refresh_token, cookieOptions(60 * 60 * 24 * 30));
};

export const clearAuthSession = (cookies: AstroCookies) => {
	cookies.delete(accessCookie, { path: '/' });
	cookies.delete(refreshCookie, { path: '/' });
};

export type AuthContext = { user: User; email: string; role: 'student' | 'admin' };

export async function getAuthContext(cookies: AstroCookies): Promise<AuthContext | undefined> {
	const client = createPublicClient();
	let accessToken = cookies.get(accessCookie)?.value;
	let user: User | undefined;
	if (accessToken) {
		const result = await client.auth.getUser(accessToken);
		user = result.data.user || undefined;
	}
	if (!user) {
		const refreshToken = cookies.get(refreshCookie)?.value;
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
	if (!email || !accessToken) return undefined;
	const role = isAdminEmail(email) ? 'admin' : 'student';
	const { error } = await createServiceClient().from('ielts_profiles').upsert({ id: user.id, email, role }, { onConflict: 'id' });
	if (error) throw new Error('profile_unavailable');
	return { user, email, role };
}
