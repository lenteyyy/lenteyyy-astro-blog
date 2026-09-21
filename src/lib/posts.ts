import mediaManifest from '../../content/media-manifest.json';
import { escapeAttribute, escapeHtml, markdownToPlainText, resolveMediaReference, safeLinkUrl } from './markdown';

export type PostCategory = '酒店测评' | '个人杂谈' | '音乐推荐' | '时尚议论' | string;

export type Post = {
	id: string;
	title: string;
	slug: string;
	description: string;
	cover: string;
	publishedAt: string;
	updatedAt: string;
	tags: string[];
	category: PostCategory;
	featured: boolean;
	published: boolean;
	content: string;
	readingMinutes: number;
};

export type PostSummary = Omit<Post, 'content'>;

type Frontmatter = Record<string, string | boolean | string[]>;

const postFiles = import.meta.glob('/content/posts/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function parseScalar(raw: string): string | boolean {
	const value = raw.trim();
	if (value === 'true') return true;
	if (value === 'false') return false;
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		try { return value.startsWith('"') ? JSON.parse(value) : value.slice(1, -1).replaceAll("''", "'"); } catch { return value.slice(1, -1); }
	}
	return value;
}

function parsePost(source: string): { data: Frontmatter; body: string } {
	const normalized = source.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n');
	if (!normalized.startsWith('---\n')) throw new Error('Article frontmatter is missing');
	const end = normalized.indexOf('\n---\n', 4);
	if (end < 0) throw new Error('Article frontmatter is not closed');
	const data: Frontmatter = {};
	let listKey = '';
	for (const rawLine of normalized.slice(4, end).split('\n')) {
		const list = rawLine.match(/^\s+-\s+(.*)$/);
		if (list && listKey && Array.isArray(data[listKey])) {
			(data[listKey] as string[]).push(String(parseScalar(list[1])));
			continue;
		}
		const item = rawLine.match(/^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/);
		if (!item) continue;
		const [, key, raw = ''] = item;
		if (!raw.trim()) {
			data[key] = [];
			listKey = key;
		} else {
			data[key] = parseScalar(raw);
			listKey = '';
		}
	}
	return { data, body: normalized.slice(end + 5).trim() };
}

function text(data: Frontmatter, key: string, fallback = ''): string {
	const value = data[key];
	return typeof value === 'string' ? value : fallback;
}

function loadPosts(): Post[] {
	return Object.values(postFiles).map((source) => {
		const { data, body } = parsePost(source);
		const slug = text(data, 'slug');
		const publishedAt = text(data, 'date');
		const plain = markdownToPlainText(body);
		return {
			id: slug,
			title: text(data, 'title', '未命名文章'),
			slug,
			description: text(data, 'summary'),
			cover: resolveMediaReference(text(data, 'cover')),
			publishedAt,
			updatedAt: publishedAt,
			tags: Array.isArray(data.tags) ? data.tags : [],
			category: text(data, 'category', '个人杂谈'),
			featured: data.featured === true,
			published: text(data, 'status') === 'published',
			content: body,
			readingMinutes: Math.max(1, Math.ceil(plain.length / 500)),
		};
	}).filter((post) => post.published).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

const posts = loadPosts();

export function formatDisplayDate(value: string): string {
	const [year, month, day] = value.slice(0, 10).split('-').map(Number);
	if (!year || !month || !day) return value;
	return `${String(year).slice(-2)}.${month}.${day}`;
}

export async function getPosts(): Promise<Post[]> {
	return posts;
}

export async function getPostBySlug(slug: string): Promise<Post | undefined> {
	return posts.find((post) => post.slug === slug);
}

export async function getTags(): Promise<Array<{ tag: string; count: number }>> {
	const counts = new Map<string, number>();
	for (const post of posts) for (const tag of post.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
	return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag, 'zh-Hans-CN'));
}

export function blocksToPlainText(content: string): string {
	return markdownToPlainText(content);
}

export { escapeAttribute, escapeHtml, safeLinkUrl };
export const publishedMediaCount = Object.keys(mediaManifest).length;
