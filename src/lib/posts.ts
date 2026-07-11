import { Client } from '@notionhq/client';

export type PostCategory = '酒店测评' | '个人杂谈' | '音乐推荐' | string;

export type RichText = {
	plain_text?: string;
	href?: string | null;
	annotations?: {
		bold?: boolean;
		italic?: boolean;
		underline?: boolean;
		strikethrough?: boolean;
		code?: boolean;
		color?: string;
	};
	text?: { link?: { url: string } | null };
};

export type NotionBlock = {
	id?: string;
	type: string;
	has_children?: boolean;
	children?: NotionBlock[];
	[key: string]: unknown;
};

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
	content: NotionBlock[];
	readingMinutes: number;
	url?: string;
};

export type PostSummary = Omit<Post, 'content'>;

export type NotionPageContent = {
	id: string;
	title: string;
	content: NotionBlock[];
	error?: boolean;
};

const isProd = import.meta.env.PROD;
const isVercel = Boolean(import.meta.env.VERCEL);
let postsCache: Promise<Post[]> | undefined;

function textOf(value: unknown): string {
	if (typeof value === 'string') return value;
	if (typeof value === 'number') return String(value);
	if (Array.isArray(value)) return value.map(textOf).join('');
	if (value && typeof value === 'object') {
		const item = value as RichText & { name?: string; start?: string };
		return String(item.plain_text || item.name || item.start || '');
	}
	return '';
}

function slugify(value: string, fallback: string): string {
	const slug = value
		.trim()
		.toLowerCase()
		.replace(/[^\p{Letter}\p{Number}]+/gu, '-')
		.replace(/^-+|-+$/g, '');
	return slug || fallback;
}

function property(properties: Record<string, any>, name: string): any {
	return properties[name];
}

function propertyText(properties: Record<string, any>, name: string): string {
	const item = property(properties, name);
	if (!item) return '';
	return textOf(item.title || item.rich_text || item.select || item.status || item.url || item.number || item.checkbox || '');
}

function propertyList(properties: Record<string, any>, name: string): string[] {
	const item = property(properties, name);
	const values = item?.multi_select || item?.rich_text || [];
	return Array.isArray(values) ? values.map(textOf).filter(Boolean) : [];
}

function propertyDate(properties: Record<string, any>, name: string, fallback: string): string {
	return property(properties, name)?.date?.start || fallback.slice(0, 10);
}

export function formatDisplayDate(value: string): string {
	const [year, month, day] = value.slice(0, 10).split('-').map(Number);
	if (!year || !month || !day) return value;
	return `${String(year).slice(-2)}.${month}.${day}`;
}

function propertyBool(properties: Record<string, any>, name: string): boolean {
	return Boolean(property(properties, name)?.checkbox);
}

function coverUrl(page: any, properties: Record<string, any>): string {
	const fromProperty = propertyText(properties, 'Cover');
	return page.cover?.external?.url || page.cover?.file?.url || fromProperty || '';
}

function isPublished(properties: Record<string, any>): boolean {
	const status = propertyText(properties, 'Status');
	return status === 'Published' || status === '已发布' || status === 'Publish';
}

function normalizePost(page: any, content: NotionBlock[]): Post {
	const properties = page.properties || {};
	const title = propertyText(properties, 'Title') || propertyText(properties, 'Name') || '未命名文章';
	const publishedAt = propertyDate(properties, 'Date', page.created_time || new Date().toISOString());
	const description = propertyText(properties, 'Summary');
	const plainContent = blocksToPlainText(content);
	return {
		id: page.id,
		title,
		slug: slugify(propertyText(properties, 'Slug') || title, page.id.replaceAll('-', '').slice(0, 12)),
		description,
		cover: coverUrl(page, properties),
		publishedAt,
		updatedAt: page.last_edited_time || publishedAt,
		tags: propertyList(properties, 'Tags'),
		category: propertyText(properties, 'Category') || '个人杂谈',
		featured: propertyBool(properties, 'Featured'),
		published: isPublished(properties),
		content,
		readingMinutes: Math.max(1, Math.ceil(plainContent.length / 500)),
		url: page.url,
	};
}

function createClient(): Client | undefined {
	const token = import.meta.env.NOTION_TOKEN;
	if (!token) {
		if (isProd && isVercel) throw new Error('Missing NOTION_TOKEN');
		console.warn('[notion] Missing NOTION_TOKEN. Returning an empty post list.');
		return undefined;
	}
	return new Client({ auth: token });
}

async function queryAllPages(client: Client): Promise<any[]> {
	const dataSourceId = import.meta.env.NOTION_DATA_SOURCE_ID;
	const databaseId = import.meta.env.NOTION_DATABASE_ID;
	if (!dataSourceId && !databaseId) {
		if (isProd && isVercel) throw new Error('Missing NOTION_DATA_SOURCE_ID or NOTION_DATABASE_ID');
		console.warn('[notion] Missing data source/database id. Returning an empty post list.');
		return [];
	}

	const pages: any[] = [];
	let start_cursor: string | undefined;
	while (true) {
		const response = dataSourceId
			? await client.dataSources.query({
					data_source_id: dataSourceId,
					page_size: 100,
					start_cursor,
					sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
				})
			: await (client as any).databases.query({
					database_id: databaseId,
					page_size: 100,
					start_cursor,
					sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
				});
		pages.push(...(response.results as any[]));
		if (!response.has_more) break;
		start_cursor = response.next_cursor || undefined;
	}
	return pages;
}

async function fetchChildren(client: Client, blockId: string): Promise<NotionBlock[]> {
	const blocks: NotionBlock[] = [];
	let start_cursor: string | undefined;
	while (true) {
		const response = await client.blocks.children.list({ block_id: blockId, page_size: 100, start_cursor });
		for (const block of response.results as any[]) {
			const normalized = block as NotionBlock;
			if (block.has_children) normalized.children = await fetchChildren(client, block.id);
			blocks.push(normalized);
		}
		if (!response.has_more) break;
		start_cursor = response.next_cursor || undefined;
	}
	return blocks;
}

async function loadPosts(): Promise<Post[]> {
	const client = createClient();
	if (!client) return [];
	try {
		const pages = await queryAllPages(client);
		const publishedPages = pages.filter((page) => isPublished(page.properties || {}));
		const posts = await Promise.all(
			publishedPages.map(async (page) => normalizePost(page, await fetchChildren(client, page.id))),
		);
		return posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
	} catch (error) {
		console.error('[notion] Failed to load posts. Check integration permissions, API version, and environment variables.');
		if (isProd && isVercel) throw new Error('Notion content load failed');
		console.error(error);
		return [];
	}
}

async function fetchPageTitle(client: Client, pageId: string): Promise<string> {
	const page = await client.pages.retrieve({ page_id: pageId }) as any;
	return propertyText(page.properties || {}, 'title') || propertyText(page.properties || {}, 'Name') || '';
}

export async function getNotionPageContent(pageId: string): Promise<NotionPageContent> {
	const client = createClient();
	if (!client) return { id: pageId, title: '', content: [], error: true };
	try {
		const [title, content] = await Promise.all([fetchPageTitle(client, pageId), fetchChildren(client, pageId)]);
		return { id: pageId, title, content };
	} catch (error) {
		console.error('[notion] Failed to load page content.');
		if (!isProd || !isVercel) console.error(error);
		return { id: pageId, title: '', content: [], error: true };
	}
}

export async function getPosts(): Promise<Post[]> {
	postsCache ||= loadPosts();
	return postsCache;
}

export async function getPostBySlug(slug: string): Promise<Post | undefined> {
	return (await getPosts()).find((post) => post.slug === slug);
}

export async function getTags(): Promise<Array<{ tag: string; count: number }>> {
	const counts = new Map<string, number>();
	for (const post of await getPosts()) {
		for (const tag of post.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
	}
	return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag, 'zh-Hans-CN'));
}

export function richTextToHtml(richText: RichText[] = []): string {
	return richText.map((item) => {
		let value = escapeHtml(item.plain_text || '');
		const annotations = item.annotations || {};
		if (annotations.code) value = `<code>${value}</code>`;
		if (annotations.bold) value = `<strong>${value}</strong>`;
		if (annotations.italic) value = `<em>${value}</em>`;
		if (annotations.underline) value = `<u>${value}</u>`;
		if (annotations.strikethrough) value = `<s>${value}</s>`;
		const href = item.href || item.text?.link?.url;
		return href ? `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${value}</a>` : value;
	}).join('');
}

export function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
}

export function escapeAttribute(value: string): string {
	return escapeHtml(value);
}

export function blockText(block: NotionBlock): string {
	const data = block[block.type] as any;
	return richTextToHtml(data?.rich_text || data?.caption || []);
}

export function blockPlainText(block: NotionBlock): string {
	const data = block[block.type] as any;
	return textOf(data?.rich_text || data?.caption || data?.title || '');
}

export function blocksToPlainText(blocks: NotionBlock[]): string {
	return blocks.map((block) => `${blockPlainText(block)} ${blocksToPlainText(block.children || [])}`).join(' ');
}

export function blockUrl(block: NotionBlock): string {
	const data = block[block.type] as any;
	return data?.external?.url || data?.file?.url || data?.url || data?.embed?.url || '';
}
