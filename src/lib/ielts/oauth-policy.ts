import { readWorkflow } from './mock/run-policy.ts';
export const OAUTH_STORAGE_KEY = 'ielts-google';
export const OAUTH_TTL_SECONDS = 600;
export const OAUTH_CALLBACK_PATH = '/api/ielts/auth/google/callback';

export function safeIeltsNext(value: unknown): string {
	if (typeof value !== 'string' || value.length > 250) return '/ielts';
	// Exact paths only: never accept a host, encoded path, nested redirect or backslash.
	if (/^\/ielts(?:\/management|\/entry-test|\/mock\/(?:c20-)?test-[1234])?(?:#[a-z-]+)?$/.test(value)) return value;
	// Preserve only the existing test subject selector, never arbitrary query parameters.
	if (/^\/ielts\/(?:entry-test|mock\/test-[1234])\?subject=(?:listening|reading|writing)(?:#[a-z-]+)?$/.test(value)) return value;
	if (/^\/ielts\/mock\/(?:c20-)?test-[1234]\?[a-zA-Z0-9%,=&-]+$/.test(value)) {
		const params = new URLSearchParams(value.split('?')[1]);
		if ([...params.keys()].every(key => ['subject','mode','subjects'].includes(key)) && readWorkflow(params)) return value;
	}
	return '/ielts';
}

export function oauthOrigin(requestUrl: string, production: boolean): string {
	const url = new URL(requestUrl);
	if (production) {
		if (url.origin !== 'https://www.lenteyyy.com') throw new Error('invalid_oauth_origin');
		return url.origin;
	}
	if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('invalid_oauth_origin');
	return url.origin;
}

export type OAuthPending = { state: string; createdAt: number; next: string; storage: Record<string, string> };

export function oauthMemoryStorage(initial: Record<string, string> = {}) {
	const values = new Map(Object.entries(initial));
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => { values.set(key, value); },
		removeItem: (key: string) => { values.delete(key); },
		// Only PKCE material may leave request memory. No session/provider tokens.
		pkceSnapshot: () => Object.fromEntries([...values].filter(([key]) => key.startsWith(`${OAUTH_STORAGE_KEY}-`) && key.endsWith('code-verifier'))),
	};
}

export function parseOAuthPending(value: string | undefined, now = Date.now()): OAuthPending | undefined {
	if (!value || value.length > 3500) return undefined;
	try {
		const pending = JSON.parse(value) as OAuthPending;
		if (!pending || !/^[a-f0-9]{64}$/.test(pending.state) || !Number.isSafeInteger(pending.createdAt)
			|| pending.createdAt > now + 30_000 || now - pending.createdAt > OAUTH_TTL_SECONDS * 1000
			|| safeIeltsNext(pending.next) !== pending.next || !pending.storage || typeof pending.storage !== 'object' || Array.isArray(pending.storage)) return undefined;
		const entries = Object.entries(pending.storage);
		if (!entries.length || entries.length > 4 || entries.some(([key, item]) =>
			!/^ielts-google-(?:[a-zA-Z0-9-]+-)?code-verifier$/.test(key) || key.length > 120 || typeof item !== 'string' || item.length > 600)) return undefined;
		return pending;
	} catch { return undefined; }
}

export function validGoogleAuthorizationUrl(value: string, supabaseUrl: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'https:' && url.origin === new URL(supabaseUrl).origin
			&& url.pathname === '/auth/v1/authorize' && !url.username && !url.password
			&& url.searchParams.get('provider') === 'google' && url.searchParams.get('code_challenge_method') === 's256'
			&& /^[A-Za-z0-9_-]{43}$/.test(url.searchParams.get('code_challenge') || '');
	} catch { return false; }
}
