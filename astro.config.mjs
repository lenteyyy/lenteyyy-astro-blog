// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';

export default defineConfig({
	site: process.env.PUBLIC_SITE_URL || 'https://lenteyyy.vercel.app',
	trailingSlash: 'never',
	adapter: vercel(),
	integrations: [react()],
	vite: {
		build: {
			chunkSizeWarningLimit: 1200,
		},
	},
});
