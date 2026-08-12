import type { APIRoute } from 'astro';
import { ImageResponse } from '@vercel/og';
import { createElement, type CSSProperties, type ReactNode } from 'react';
import { translateText, type SiteLocale } from '../../../lib/locale';
import { formatDisplayDate, getPostBySlug, type Post } from '../../../lib/posts';
import { canonicalUrl } from '../../../lib/site';

export const prerender = false;

const h = (tag: string, style: CSSProperties, children?: ReactNode, props: Record<string, unknown> = {}) =>
	createElement(tag, { style, ...props }, children);

export function createOgImage(post: Pick<Post, 'title' | 'category' | 'publishedAt' | 'readingMinutes'>, locale: SiteLocale): ImageResponse {
	const title = translateText(post.title, locale);
	const category = translateText(post.category, locale);
	const titleSize = title.length > 60 ? 38 : title.length > 42 ? 46 : title.length > 28 ? 56 : 68;
	const readingLabel = locale === 'zh-TW' ? `預估閱讀 ${post.readingMinutes} 分鐘` : `预计阅读 ${post.readingMinutes} 分钟`;

	const card = h('div', {
		display: 'flex', position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
		padding: '58px', color: '#efe9df', backgroundImage: 'linear-gradient(135deg, #15130f 0%, #251d18 58%, #3a2722 100%)',
		fontFamily: 'Noto Sans SC, sans-serif',
	}, [
		h('div', { display: 'flex', position: 'absolute', inset: '28px', border: '1px solid rgba(216,160,150,.38)' }),
		h('div', { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', zIndex: 1 }, [
			h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
				h('div', { display: 'flex', alignItems: 'center', gap: '20px' }, [
					createElement('img', { src: canonicalUrl('/assets/lenteyyy-logo.png'), width: 86, height: 86, style: { borderRadius: '50%', background: '#f8f5ef', objectFit: 'cover' } }),
					h('div', { display: 'flex', flexDirection: 'column' }, [
						h('span', { fontSize: 25, fontWeight: 700, letterSpacing: '3px' }, 'LENTEYYY'),
						h('span', { marginTop: '4px', color: '#b8ada3', fontSize: 17, letterSpacing: '2px' }, 'PERSONAL BLOG'),
					]),
				]),
				h('span', { color: '#d8a096', fontSize: 22, letterSpacing: '2px' }, category),
			]),
			h('div', { display: 'flex', flexDirection: 'column', width: '100%', padding: '0 28px' }, [
				h('div', { display: 'flex', maxWidth: '980px', maxHeight: '204px', overflow: 'hidden', fontSize: titleSize, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-1px', wordBreak: 'break-word' }, title),
				h('div', { display: 'flex', width: '100%', height: '2px', margin: '27px 0 22px', background: '#9d4a3d' }),
				h('div', { display: 'flex', gap: '24px', color: '#c8bcb0', fontSize: 21, letterSpacing: '1px' }, [
					h('span', {}, formatDisplayDate(post.publishedAt)),
					h('span', { color: '#8f8378' }, '·'),
					h('span', {}, readingLabel),
			]),
			]),
			h('div', { display: 'flex', justifyContent: 'flex-end', color: '#8f8378', fontSize: 18, letterSpacing: '2px' }, 'lenteyyy.com'),
		]),
	]);

	return new ImageResponse(card, {
		width: 1200,
		height: 630,
		headers: { 'cache-control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800' },
	});
}

export const GET: APIRoute = async ({ params, url }) => {
	const slug = params.slug?.replace(/\.png$/, '') || '';
	const post = await getPostBySlug(slug);
	if (!post) return new Response('Not found', { status: 404 });
	const locale: SiteLocale = url.searchParams.get('locale') === 'zh-tw' ? 'zh-TW' : 'zh-CN';
	return createOgImage(post, locale);
};
