import { createServiceClient } from './supabase';

export const sha256 = async (value: string): Promise<string> => {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const verificationHash = async (email: string, code: string, secret: string): Promise<string> => sha256(`${secret}|${email}|${code}`);

export const constantTimeEqual = (left: string, right: string): boolean => {
	const a = new TextEncoder().encode(left);
	const b = new TextEncoder().encode(right);
	if (a.length !== b.length) return false;
	let difference = 0;
	for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
	return difference === 0;
};

export const createSixDigitCode = (): string => {
	const maximum = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
	const values = new Uint32Array(1);
	do crypto.getRandomValues(values); while (values[0] >= maximum);
	return String(values[0] % 1_000_000).padStart(6, '0');
};

const requestAddress = (request: Request): string => request.headers.get('cf-connecting-ip')
	|| request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
	|| request.headers.get('x-real-ip')
	|| 'unknown';

export async function claimRateLimit(request: Request, scope: string, identity: string, limit: number, windowSeconds: number): Promise<boolean> {
	const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
	const fingerprint = await sha256(`${scope}|${bucket}|${requestAddress(request)}|${request.headers.get('user-agent') || 'unknown'}|${identity}`);
	const { data, error } = await createServiceClient().rpc('claim_ielts_rate_limit', {
		p_key_hash: fingerprint,
		p_limit: limit,
		p_window_seconds: windowSeconds,
	});
	if (error) throw new Error('rate_limit_unavailable');
	return data === true;
}

export const safeFileName = (name: string): string => {
	const normalized = name.normalize('NFKC').replace(/[\u0000-\u001f\u007f/\\]/g, '-').replace(/\s+/g, ' ').trim();
	return normalized.slice(0, 180) || 'material';
};
