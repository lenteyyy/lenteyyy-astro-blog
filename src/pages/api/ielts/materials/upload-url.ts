import type { APIRoute } from 'astro';
import { getAuthContext } from '../../../../lib/ielts/auth';
import { json, readJson, sameOrigin } from '../../../../lib/ielts/http';
import { claimRateLimit, safeFileName } from '../../../../lib/ielts/security';
import { createServiceClient } from '../../../../lib/ielts/supabase';

export const prerender = false;

const mimeTypes = new Set([
	'application/pdf',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'video/mp4', 'image/jpeg', 'image/png', 'image/webp',
]);

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
	try {
		const auth = await getAuthContext(cookies);
		if (!auth || auth.role !== 'admin') return json({ error: 'forbidden' }, 403);
		if (!(await claimRateLimit(request, 'material-upload', auth.user.id, 30, 3600, 'identity'))) return json({ error: 'rate_limited' }, 429);
		const body = await readJson<Record<string, unknown>>(request);
		const fileName = safeFileName(String(body.fileName || ''));
		const mimeType = String(body.mimeType || '').toLowerCase();
		const sizeBytes = Number(body.sizeBytes || 0);
		if (!mimeTypes.has(mimeType) || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 104857600) return json({ error: 'invalid_file' }, 400);
		const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}/${fileName}`;
		const { data, error } = await createServiceClient().storage.from('ielts-materials').createSignedUploadUrl(path, { upsert: false });
		if (error || !data) throw error || new Error('signed_upload_failed');
		return json({ path: data.path, token: data.token });
	} catch (error) {
		if (error instanceof Error && ['invalid_content_type', 'payload_too_large'].includes(error.message)) return json({ error: error.message }, 400);
		return json({ error: 'upload_unavailable' }, 503);
	}
};
