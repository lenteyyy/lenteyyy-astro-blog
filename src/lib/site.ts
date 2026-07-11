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
