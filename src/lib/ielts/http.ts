const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), {
	status,
	headers: {
		'content-type': 'application/json; charset=utf-8',
		'cache-control': 'no-store, private',
		'cdn-cache-control': 'no-store',
		'vercel-cdn-cache-control': 'no-store',
		'vary': 'Cookie',
		...headers,
	},
});

export const sameOrigin = (request: Request): boolean => {
	const origin = request.headers.get('origin');
	if (!origin) return false;
	try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
};

export async function readJson<T>(request: Request, maxBytes = 12_000): Promise<T> {
	if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new Error('invalid_content_type');
	const statedSize = Number(request.headers.get('content-length') || 0);
	if (statedSize > maxBytes) throw new Error('payload_too_large');
	const reader = request.body?.getReader();
	if (!reader) throw new Error('invalid_json');
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > maxBytes) {
				await reader.cancel();
				throw new Error('payload_too_large');
			}
			chunks.push(value);
		}
	} finally { reader.releaseLock(); }
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
	try {
		const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid_json');
		return parsed as T;
	} catch { throw new Error('invalid_json'); }
}

export const normalizeEmail = (value: unknown): string | undefined => {
	const email = String(value || '').trim().toLowerCase();
	return email.length <= 254 && emailPattern.test(email) ? email : undefined;
};

export const cleanText = (value: unknown, max: number): string => String(value || '')
	.normalize('NFKC')
	.replace(/\r\n?/g, '\n')
	.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
	.trim()
	.slice(0, max);

export const cleanLine = (value: unknown, max: number): string => cleanText(value, max)
	.replace(/\s+/g, ' ')
	.slice(0, max);
