import { Client } from '@notionhq/client';

export type PostCategory = '酒店测评' | '个人杂谈' | '音乐推荐';

export type Post = {
	id: string;
	title: string;
	slug: string;
	date: string;
	category: PostCategory;
	tags: string[];
	summary: string;
	cover: string;
	blocks: NotionBlock[];
	url?: string;
};

export type NotionBlock = {
	id?: string;
	type: string;
	children?: NotionBlock[];
	[key: string]: unknown;
};

type RichText = {
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

const fallbackPosts: Post[] = [
	{
		id: 'sample-wuhu',
		title: '芜湖世贸希尔顿逸林酒店',
		slug: 'wuhu-doubletree-hilton',
		date: '2026-06-28',
		category: '酒店测评',
		tags: ['酒店', '希尔顿', '芜湖'],
		summary: '一篇关于入住、空间和城市停留感受的酒店记录。',
		cover: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1600&q=85',
		blocks: [
			{ type: 'heading_2', heading_2: { rich_text: [{ plain_text: '先说结论' }] } },
			{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: '这里是本地预览内容。接入 Notion 数据库后，文章正文会在构建时自动读取。' }] } },
			{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: '你仍然在 Notion 里写作，Astro 只负责把内容整理成更快、更可控的网站。' }] } },
		],
	},
	{
		id: 'sample-taipei-w',
		title: '台北 W 酒店',
		slug: 'w-taipei',
		date: '2026-06-12',
		category: '酒店测评',
		tags: ['酒店', '台北', 'W Hotels'],
		summary: '从房间、公共空间到服务细节，记录一次城市酒店体验。',
		cover: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=85',
		blocks: [
			{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: '这是一篇待接入 Notion 正文的预览文章。' }] } },
		],
	},
	{
		id: 'sample-summer',
		title: '二六年的初夏，我',
		slug: 'early-summer-2026',
		date: '2026-06-08',
		category: '个人杂谈',
		tags: ['生活', '随笔'],
		summary: '一些没有被归档成结论的想法。',
		cover: 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=1600&q=85',
		blocks: [
			{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: '有些文章不需要一个特别明确的主题，记录本身就是主题。' }] } },
		],
	},
];

function textOf(value: unknown): string {
	if (typeof value === 'string') return value;
	if (Array.isArray(value)) return value.map(textOf).join('');
	if (value && typeof value === 'object') {
		const item = value as RichText & { name?: string; start?: string };
		return String(item.plain_text || item.name || item.start || '');
	}
	return '';
}

function slugify(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^\p{Letter}\p{Number}]+/gu, '-')
		.replace(/^-+|-+$/g, '') || `post-${Date.now()}`;
}

function propertyText(properties: Record<string, any>, name: string): string {
	const property = properties[name];
	if (!property) return '';
	return textOf(property.title || property.rich_text || property.select || property.url || property.number || '');
}

function propertyList(properties: Record<string, any>, name: string): string[] {
	const property = properties[name];
	if (!property) return [];
	const values = property.multi_select || property.rich_text || [];
	return Array.isArray(values) ? values.map(textOf).filter(Boolean) : [];
}

function propertyDate(properties: Record<string, any>, name: string): string {
	return properties[name]?.date?.start || properties[name]?.created_time || new Date().toISOString().slice(0, 10);
}

function normalizePost(page: any): Omit<Post, 'blocks'> {
	const properties = page.properties || {};
	const title = propertyText(properties, 'Title') || propertyText(properties, 'Name') || page.title || '未命名文章';
	const category = propertyText(properties, 'Category') as PostCategory;
	return {
		id: page.id,
		title,
		slug: propertyText(properties, 'Slug') || slugify(title),
		date: propertyDate(properties, 'Date'),
		category: ['酒店测评', '个人杂谈', '音乐推荐'].includes(category) ? category : '个人杂谈',
		tags: propertyList(properties, 'Tags'),
		summary: propertyText(properties, 'Summary'),
		cover: page.cover?.external?.url || page.cover?.file?.url || '',
		url: page.url,
	};
}

async function fetchChildren(client: Client, blockId: string): Promise<NotionBlock[]> {
	const blocks: NotionBlock[] = [];
	let cursor: string | undefined;
	while (true) {
		const response = await client.blocks.children.list({ block_id: blockId, page_size: 100, start_cursor: cursor });
		for (const block of response.results as any[]) {
			const normalized = block as NotionBlock;
			if (block.has_children) normalized.children = await fetchChildren(client, block.id);
			blocks.push(normalized);
		}
		if (!response.has_more) break;
		cursor = response.next_cursor || undefined;
	}
	return blocks;
}

export async function getPosts(): Promise<Post[]> {
	const token = import.meta.env.NOTION_TOKEN;
	const dataSourceId = import.meta.env.NOTION_DATA_SOURCE_ID || import.meta.env.NOTION_DATABASE_ID;
	if (!token || !dataSourceId) return fallbackPosts;

	try {
		const client = new Client({ auth: token });
		const response = await client.dataSources.query({ data_source_id: dataSourceId, page_size: 100 });
		const posts = await Promise.all(
			(response.results as any[]).map(async (page) => ({
				...normalizePost(page),
				blocks: await fetchChildren(client, page.id),
			})),
		);
		if (posts.length === 0) return fallbackPosts;
		return posts
			.filter((post) => {
				const status = propertyText((response.results as any[]).find((page) => page.id === post.id)?.properties || {}, 'Status');
				return !status || status === 'Published' || status === '已发布';
			})
			.sort((a, b) => b.date.localeCompare(a.date));
	} catch (error) {
		console.warn('Notion unavailable, using preview content.', error);
		return fallbackPosts;
	}
}

export async function getPostBySlug(slug: string): Promise<Post | undefined> {
	return (await getPosts()).find((post) => post.slug === slug);
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

function escapeAttribute(value: string): string {
	return escapeHtml(value);
}

export function blockText(block: NotionBlock): string {
	const data = block[block.type] as any;
	return richTextToHtml(data?.rich_text || data?.caption || []);
}

export function blockUrl(block: NotionBlock): string {
	const data = block[block.type] as any;
	return data?.external?.url || data?.file?.url || data?.url || data?.embed?.url || '';
}
