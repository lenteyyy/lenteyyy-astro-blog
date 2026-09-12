export const site = {
	name: 'Lenteyyy',
	title: 'Lenteyyy · 个人博客',
	description: '酒店、旅行、音乐和一些个人杂谈。',
	url: import.meta.env.PUBLIC_SITE_URL || 'https://lenteyyy.vercel.app',
	locale: 'zh_CN',
	lang: 'zh-CN',
	author: 'Lenteyyy',
	defaultOgImage: '/og-default.svg',
};

export const giscusConfig = {
	repo: import.meta.env.PUBLIC_GISCUS_REPO || '',
	repoId: import.meta.env.PUBLIC_GISCUS_REPO_ID || '',
	category: import.meta.env.PUBLIC_GISCUS_CATEGORY || '',
	categoryId: import.meta.env.PUBLIC_GISCUS_CATEGORY_ID || '',
};

export function canonicalUrl(path = '/'): string {
	return new URL(path, site.url).toString();
}

export function socialImagePath(slug: string, locale: 'zh-CN' | 'zh-TW' = 'zh-CN'): string {
	const prefix = locale === 'zh-TW' ? '/api/og/zh-tw' : '/api/og';
	return `${prefix}/${encodeURIComponent(slug)}.png`;
}

export function serializeJsonLd(value: unknown): string {
	return JSON.stringify(value)
		.replaceAll('<', '\\u003c')
		.replaceAll('\u2028', '\\u2028')
		.replaceAll('\u2029', '\\u2029');
}
