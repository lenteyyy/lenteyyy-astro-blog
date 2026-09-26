import { createServiceClient } from './supabase';

const sha256 = async (value: string): Promise<string> => {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
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
