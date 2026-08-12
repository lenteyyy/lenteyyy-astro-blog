type RedisResult = { result?: unknown };

function redisConfig(): { url: string; token: string } | undefined {
	const url = import.meta.env.UPSTASH_REDIS_REST_URL || import.meta.env.KV_REST_API_URL;
	const token = import.meta.env.UPSTASH_REDIS_REST_TOKEN || import.meta.env.KV_REST_API_TOKEN;
	return url && token ? { url, token } : undefined;
}

export async function redis(command: unknown[]): Promise<RedisResult> {
	const config = redisConfig();
	if (!config) throw new Error('Missing Redis env');
	const response = await fetch(config.url, {
		method: 'POST',
		headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
		body: JSON.stringify(command),
	});
	if (!response.ok) throw new Error('Redis request failed');
	return response.json() as Promise<RedisResult>;
}

async function fingerprint(request: Request, scope: string): Promise<string> {
	const forwarded = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
	const userAgent = request.headers.get('user-agent') || 'unknown';
	const input = new TextEncoder().encode(`${scope}|${forwarded}|${userAgent}`);
	const digest = await crypto.subtle.digest('SHA-256', input);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function withinRateLimit(request: Request, scope: string, limit: number, windowSeconds: number): Promise<boolean> {
	if (!redisConfig()) return true;
	const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
	const hash = await fingerprint(request, `${scope}|${bucket}`);
	const key = `ratelimit:${scope}:${bucket}:${hash}`;
	const script = "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return count";
	const result = await redis(['EVAL', script, '1', key, String(windowSeconds + 5)]);
	const count = Number(result.result) || 0;
	return count <= limit;
}

export async function claimDailyView(request: Request, slug: string): Promise<boolean> {
	const day = new Date().toISOString().slice(0, 10);
	const hash = await fingerprint(request, `view|${slug}|${day}`);
	const result = await redis(['SET', `post:viewed:${slug}:${day}:${hash}`, '1', 'NX', 'EX', 90000]);
	return result.result === 'OK';
}
