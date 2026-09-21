import { Marked, Renderer, type Tokens } from 'marked';
import mediaManifest from '../../content/media-manifest.json';
import { translateText, type SiteLocale } from './locale';

const media = mediaManifest as Record<string, string>;

export function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
}

export function escapeAttribute(value: string): string {
	return escapeHtml(value);
}

export function safeLinkUrl(value: string, protocols = ['http:', 'https:', 'mailto:', 'tel:']): string {
	const trimmed = value.trim();
	if (!trimmed) return '';
	if (trimmed.startsWith('#') || (trimmed.startsWith('/') && !trimmed.startsWith('//'))) return trimmed;
	try {
		const parsed = new URL(trimmed);
		return protocols.includes(parsed.protocol) ? parsed.toString() : '';
	} catch {
		return '';
	}
}

export function resolveMediaReference(value: string): string {
	const match = value.trim().match(/^!?\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]$/);
	if (match) return media[match[1].trim()] || '';
	if (value.startsWith('/media/')) return value;
	return safeLinkUrl(value, ['https:']);
}

function prepareWikiImages(source: string): string {
	return source.replace(/!\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g, (_match, rawRef: string, rawCaption = '') => {
		const ref = rawRef.trim();
		const url = media[ref];
		if (!url) return '';
		const caption = String(rawCaption).trim().replaceAll('[', '\\[').replaceAll(']', '\\]');
		return `![${caption}](${url})`;
	});
}

function youtubeEmbedUrl(value: string): string {
	try {
		const url = new URL(value);
		const host = url.hostname.replace(/^www\./, '');
		if (!['youtu.be', 'youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) return '';
		const id = host === 'youtu.be' ? url.pathname.slice(1) : url.pathname.startsWith('/embed/') ? url.pathname.split('/')[2] : url.searchParams.get('v');
		return id && /^[A-Za-z0-9_-]{6,32}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : '';
	} catch {
		return '';
	}
}

function spotifyEmbedUrl(value: string): string {
	try {
		const url = new URL(value);
		if (url.hostname !== 'open.spotify.com') return '';
		const parts = url.pathname.split('/').filter(Boolean);
		if (parts[0]?.startsWith('intl-')) parts.shift();
		const [type, id] = parts;
		if (!type || !id || !/^[A-Za-z0-9]+$/.test(id)) return '';
		return `https://open.spotify.com/embed/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
	} catch {
		return '';
	}
}

function appleMusicEmbedUrl(value: string): string {
	try {
		const url = new URL(value);
		if (url.hostname !== 'music.apple.com') return '';
		url.hostname = 'embed.music.apple.com';
		return url.toString();
	} catch {
		return '';
	}
}

function renderEmbed(value: string): string {
	const url = safeLinkUrl(value, ['https:']);
	if (!url) return '';
	const youtube = youtubeEmbedUrl(url);
	if (youtube) return `<figure class="media-embed media-embed-youtube"><iframe src="${escapeAttribute(youtube)}" title="YouTube embedded player" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></figure>`;
	const spotify = spotifyEmbedUrl(url);
	if (spotify) return `<figure class="media-embed media-embed-spotify"><iframe src="${escapeAttribute(spotify)}" title="Spotify embedded player" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe></figure>`;
	const apple = appleMusicEmbedUrl(url);
	if (apple) return `<figure class="media-embed media-embed-apple"><iframe src="${escapeAttribute(apple)}" title="Apple Music embedded player" loading="lazy" allow="autoplay *; encrypted-media *; fullscreen *"></iframe></figure>`;
	return '';
}

function headingId(value: string): string {
	return value.trim().toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-+|-+$/g, '');
}


function createBlogRenderer(locale: SiteLocale): Renderer {
	const headingCounts = new Map<string, number>();
	return {
	html({ text }: Tokens.HTML | Tokens.Tag): string {
		if (/^<\/?u>$/i.test(text.trim())) return text.trim().toLowerCase();
		if (/^<!--[\s\S]*-->$/.test(text.trim())) return '';
		return escapeHtml(text);
	},

	heading(this: Renderer, { tokens, depth }: Tokens.Heading): string {
		const html = this.parser.parseInline(tokens);
		const translated = translateText(html.replace(/<[^>]*>/g, ''), locale);
		const base = headingId(translated) || 'section';
		const count = headingCounts.get(base) || 0;
		headingCounts.set(base, count + 1);
		const id = count ? `${base}-${count + 1}` : base;
		const level = depth >= 3 ? 3 : 2;
		const label = locale === 'zh-TW' ? '複製標題連結' : '复制标题链接';
		return `<h${level} id="${escapeAttribute(id)}">${html}<button type="button" class="heading-anchor" data-anchor="${escapeAttribute(id)}" aria-label="${label}">#</button></h${level}>\n`;
	},

	paragraph(this: Renderer, { tokens }: Tokens.Paragraph): string {
		if (tokens.length === 1) {
			const token = tokens[0];
			if (token.type === 'image') {
				const embed = renderEmbed(token.href);
				if (embed) return `${embed}\n`;
				return `${this.image(token as Tokens.Image)}\n`;
			}
			if (token.type === 'link') {
				const embed = renderEmbed(token.href);
				if (embed) return `${embed}\n`;
			}
		}
		return `<p>${this.parser.parseInline(tokens)}</p>\n`;
	},

	link(this: Renderer, { href, title, tokens }: Tokens.Link): string {
		const url = safeLinkUrl(href);
		const text = this.parser.parseInline(tokens);
		if (!url) return text;
		const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : '';
		return `<a href="${escapeAttribute(url)}"${titleAttribute} target="_blank" rel="noopener noreferrer">${text}</a>`;
	},

	image({ href, text }: Tokens.Image): string {
		const url = href.startsWith('/media/') ? href : safeLinkUrl(href, ['https:']);
		if (!url) return '';
		const alt = text || '';
		return `<figure class="article-image"><img src="${escapeAttribute(url)}" alt="${escapeAttribute(alt)}" loading="lazy" decoding="async" data-lightbox-image data-caption="${escapeAttribute(alt)}" />${alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : ''}</figure>`;
	},

	code({ text, lang }: Tokens.Code): string {
		const language = lang?.match(/^[\w-]+/)?.[0] || '';
		const className = language ? ` class="language-${escapeAttribute(language)}"` : '';
		return `<div class="code-wrap"><button type="button" class="copy-code">${locale === 'zh-TW' ? '複製' : '复制'}</button><pre><code${className}>${escapeHtml(text)}</code></pre></div>\n`;
	},
	} as Renderer;
}

function groupImageGalleries(html: string): string {
	return html.replace(/((?:<figure class="article-image"><img [^>]*\/><figcaption>[\s\S]*?<\/figcaption><\/figure>\s*|<figure class="article-image"><img [^>]*\/><\/figure>\s*){2,})/g, (group) => {
		const count = Math.min((group.match(/<figure class="article-image">/g) || []).length, 4);
		return `<div class="image-gallery image-gallery-${count}">${group}</div>`;
	});
}

function translateHtmlText(html: string, locale: SiteLocale): string {
	if (locale !== 'zh-TW') return html;
	let skipped = 0;
	return html.split(/(<[^>]+>)/g).map((part) => {
		if (part.startsWith('<')) {
			if (/^<(?:pre|code|script|style)(?:\s|>)/i.test(part)) skipped += 1;
			if (/^<\/(?:pre|code|script|style)>/i.test(part)) skipped = Math.max(0, skipped - 1);
			return part;
		}
		return skipped ? part : translateText(part, locale);
	}).join('');
}

export function renderMarkdown(source: string, locale: SiteLocale = 'zh-CN'): string {
	const renderer = createBlogRenderer(locale);
	const parser = new Marked({ renderer, gfm: true, breaks: false, async: false });
	const html = parser.parse(prepareWikiImages(source)) as string;
	return translateHtmlText(groupImageGalleries(html), locale);
}

export function markdownToPlainText(source: string): string {
	return renderMarkdown(source)
		.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

export function getMarkdownHeadings(source: string, locale: SiteLocale = 'zh-CN'): Array<{ text: string; id: string; level: 2 | 3 }> {
	const counts = new Map<string, number>();
	const headings: Array<{ text: string; id: string; level: 2 | 3 }> = [];
	for (const match of source.matchAll(/^(#{1,6})\s+(.+?)\s*#*$/gm)) {
		const text = translateText(match[2].replace(/[*_`~\[\]]/g, '').trim(), locale);
		const base = headingId(text) || 'section';
		const count = counts.get(base) || 0;
		counts.set(base, count + 1);
		headings.push({ text, id: count ? `${base}-${count + 1}` : base, level: match[1].length >= 3 ? 3 : 2 });
	}
	return headings;
}
