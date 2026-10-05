// Vercel overwrites these forwarding headers at its edge. Do not trust
// arbitrary Cloudflare headers or user-agent strings for security limits.
export function rateLimitAddress(request: Request): string {
	return request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
		|| request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
		|| 'unknown';
}
