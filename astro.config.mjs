// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';

const canonicalSite = 'https://www.lenteyyy.com';
if (process.env.PUBLIC_SITE_URL) {
	const configured = new URL(process.env.PUBLIC_SITE_URL);
	if (!['https://www.lenteyyy.com', 'https://lenteyyy.com', 'https://lenteyyy.vercel.app'].includes(configured.origin)
		|| configured.pathname !== '/' || configured.search || configured.hash || configured.username || configured.password) {
		throw new Error('Blog site configuration points outside the blog');
	}
}

export default defineConfig({
	site: canonicalSite,
	trailingSlash: 'never',
	adapter: vercel(),
	integrations: [react()],
	vite: {
		build: {
			chunkSizeWarningLimit: 1200,
			assetsInlineLimit: 0,
		},
	},
});
