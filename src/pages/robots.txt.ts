import type { APIRoute } from 'astro';
import { canonicalUrl } from '../lib/site';

export const GET: APIRoute = () => new Response(`User-agent: *
Allow: /

Sitemap: ${canonicalUrl('/sitemap.xml')}
`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
