import { Client } from '@notionhq/client';
import type { APIRoute } from 'astro';

const notionIdPattern = /^[0-9a-f-]{32,36}$/i;

export const prerender = false;

function validId(value: string | null): value is string {
	return Boolean(value && notionIdPattern.test(value));
}

async function imageUrlForRequest(client: Client, blockId: string | null, pageId: string | null): Promise<string> {
	if (blockId) {
		const block = await client.blocks.retrieve({ block_id: blockId }) as any;
		if (block.type !== 'image') return '';
		return block.image?.file?.url || block.image?.external?.url || '';
	}
	if (pageId) {
		const page = await client.pages.retrieve({ page_id: pageId }) as any;
		return page.cover?.file?.url || page.cover?.external?.url || '';
	}
	return '';
}

export const GET: APIRoute = async ({ url }) => {
	const blockId = url.searchParams.get('block');
	const pageId = url.searchParams.get('page');
	if ((blockId && !validId(blockId)) || (pageId && !validId(pageId)) || (!blockId && !pageId)) {
		return new Response('Invalid image request', { status: 400 });
	}

	const token = import.meta.env.NOTION_TOKEN;
	if (!token) return new Response('Image service unavailable', { status: 503 });

	try {
		const client = new Client({ auth: token });
		const source = await imageUrlForRequest(client, blockId, pageId);
		if (!source) return new Response('Image not found', { status: 404 });

		const image = await fetch(source);
		if (!image.ok || !image.body) return new Response('Image fetch failed', { status: 502 });

		return new Response(image.body, {
			headers: {
				'Content-Type': image.headers.get('content-type') || 'image/jpeg',
				'Cache-Control': 'public, max-age=900, s-maxage=1800, stale-while-revalidate=86400',
			},
		});
	} catch {
		return new Response('Image fetch failed', { status: 502 });
	}
};
