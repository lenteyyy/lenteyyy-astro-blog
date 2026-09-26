import type { APIRoute } from 'astro';
import { getAuthContext } from '../../../../lib/ielts/auth';
import { cleanText, json, readJson, sameOrigin } from '../../../../lib/ielts/http';
import { createServiceClient } from '../../../../lib/ielts/supabase';

export const prerender = false;

const categories = new Set(['听力', '阅读', '写作', '口语', '词汇', '语法', '备考']);
const mimeTypes = new Set([
	'application/pdf',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'video/mp4', 'image/jpeg', 'image/png', 'image/webp',
]);
const managedStoragePath = /^[\d-]{10}\/[a-f0-9-]{36}\/[^/]{1,180}$/i;

const removeUploadedFile = async (storagePath: string) => {
	if (!managedStoragePath.test(storagePath)) return;
	await createServiceClient().storage.from('ielts-materials').remove([storagePath]).catch(() => undefined);
};

export const GET: APIRoute = async ({ cookies }) => {
	try {
		const auth = await getAuthContext(cookies);
		if (!auth) return json({ error: 'unauthorized' }, 401);
		let query = createServiceClient().from('ielts_materials')
			.select('id, title, category, description, file_name, mime_type, size_bytes, created_at, published')
			.order('created_at', { ascending: false });
		if (auth.role !== 'admin') query = query.eq('published', true);
		const { data, error } = await query;
		if (error) throw error;
		return json({ materials: data || [], role: auth.role });
	} catch {
		return json({ error: 'materials_unavailable' }, 503);
	}
};

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
	let storagePath = '';
	try {
		const auth = await getAuthContext(cookies);
		if (!auth || auth.role !== 'admin') return json({ error: 'forbidden' }, 403);
		const body = await readJson<Record<string, unknown>>(request);
		const title = cleanText(body.title, 120);
		const description = cleanText(body.description, 300);
		const category = String(body.category || '');
		storagePath = String(body.storagePath || '');
		const fileName = cleanText(body.fileName, 180);
		const mimeType = String(body.mimeType || '').toLowerCase();
		const sizeBytes = Number(body.sizeBytes || 0);
		if (!title || !categories.has(category) || !managedStoragePath.test(storagePath) || !fileName || !mimeTypes.has(mimeType) || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 104857600) {
			await removeUploadedFile(storagePath);
			return json({ error: 'invalid_material' }, 400);
		}
		const client = createServiceClient();
		const exists = await client.storage.from('ielts-materials').exists(storagePath);
		if (exists.error) throw exists.error;
		if (!exists.data) return json({ error: 'upload_missing' }, 409);
		const { data, error } = await client.from('ielts_materials').insert({
			title, category, description, storage_path: storagePath, file_name: fileName,
			mime_type: mimeType, size_bytes: sizeBytes, uploaded_by: auth.user.id, published: true,
		}).select('id, title, category, description, file_name, mime_type, size_bytes, created_at, published').single();
		if (error || !data) throw error || new Error('material_insert_failed');
		return json({ ok: true, material: data }, 201);
	} catch (error) {
		await removeUploadedFile(storagePath);
		if (error instanceof Error && ['invalid_content_type', 'payload_too_large'].includes(error.message)) return json({ error: error.message }, 400);
		return json({ error: 'material_unavailable' }, 503);
	}
};
