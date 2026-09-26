const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), {
	status,
	headers: {
		'content-type': 'application/json; charset=utf-8',
		'cache-control': 'no-store, private',
		...headers,
	},
});

export const sameOrigin = (request: Request): boolean => {
	const origin = request.headers.get('origin');
	if (!origin) return false;
	try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
};

export async function readJson<T>(request: Request, maxBytes = 12_000): Promise<T> {
	if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('invalid_content_type');
	const statedSize = Number(request.headers.get('content-length') || 0);
	if (statedSize > maxBytes) throw new Error('payload_too_large');
	const text = await request.text();
	if (new TextEncoder().encode(text).length > maxBytes) throw new Error('payload_too_large');
	return JSON.parse(text) as T;
}

export const normalizeEmail = (value: unknown): string | undefined => {
	const email = String(value || '').trim().toLowerCase();
	return email.length <= 254 && emailPattern.test(email) ? email : undefined;
};

export const cleanText = (value: unknown, max: number): string => String(value || '').trim().slice(0, max);
