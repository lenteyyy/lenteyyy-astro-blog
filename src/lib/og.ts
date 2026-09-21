import { ImageResponse } from '@vercel/og';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement, type CSSProperties, type ReactNode } from 'react';
import { translateText, type SiteLocale } from './locale';
import { formatDisplayDate, type Post } from './posts';

function readAsset(relativePath: string): Buffer {
	return readFileSync(path.join(process.cwd(), relativePath));
}

function arrayBuffer(buffer: Buffer): ArrayBuffer {
	return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

const logo = `data:image/png;base64,${readAsset('public/assets/lenteyyy-logo.png').toString('base64')}`;
const simplifiedRegularFont = arrayBuffer(readAsset('node_modules/@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff'));
const simplifiedBoldFont = arrayBuffer(readAsset('node_modules/@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-700-normal.woff'));
const traditionalRegularFont = arrayBuffer(readAsset('node_modules/@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-400-normal.woff'));
const traditionalBoldFont = arrayBuffer(readAsset('node_modules/@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-700-normal.woff'));

const h = (tag: string, style: CSSProperties, children?: ReactNode, props: Record<string, unknown> = {}) =>
	createElement(tag, { style, ...props }, children);

export function createOgImage(post: Pick<Post, 'title' | 'category' | 'publishedAt' | 'readingMinutes'>, locale: SiteLocale): ImageResponse {
	const title = translateText(post.title, locale).replace(/\p{Extended_Pictographic}/gu, '').trim();
	const category = translateText(post.category, locale);
	const fontFamily = locale === 'zh-TW' ? 'Noto Sans TC, Noto Sans SC' : 'Noto Sans SC';
	const titleSize = title.length > 60 ? 38 : title.length > 42 ? 46 : title.length > 28 ? 56 : 68;
	const readingLabel = locale === 'zh-TW' ? `預估閱讀 ${post.readingMinutes} 分鐘` : `预计阅读 ${post.readingMinutes} 分钟`;

	const card = h('div', {
		display: 'flex', position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
		padding: '58px', color: '#efe9df', backgroundImage: 'linear-gradient(135deg, #15130f 0%, #251d18 58%, #3a2722 100%)',
		fontFamily,
	}, [
		h('div', { display: 'flex', position: 'absolute', inset: '28px', border: '1px solid rgba(216,160,150,.38)' }),
		h('div', { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%' }, [
			h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
				h('div', { display: 'flex', alignItems: 'center', gap: '20px' }, [
					createElement('img', { src: logo, width: 86, height: 86, style: { borderRadius: '50%', background: '#f8f5ef', objectFit: 'cover' } }),
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
		fonts: locale === 'zh-TW' ? [
			{ name: 'Noto Sans TC', data: traditionalRegularFont, weight: 400, style: 'normal' },
			{ name: 'Noto Sans TC', data: traditionalBoldFont, weight: 700, style: 'normal' },
			{ name: 'Noto Sans SC', data: simplifiedRegularFont, weight: 400, style: 'normal' },
			{ name: 'Noto Sans SC', data: simplifiedBoldFont, weight: 700, style: 'normal' },
		] : [
			{ name: 'Noto Sans SC', data: simplifiedRegularFont, weight: 400, style: 'normal' },
			{ name: 'Noto Sans SC', data: simplifiedBoldFont, weight: 700, style: 'normal' },
		],
		headers: { 'cache-control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800' },
	});
}
