import type { APIRoute } from 'astro';
import { getAuthContext } from '../../../../lib/ielts/auth';
import { json } from '../../../../lib/ielts/http';
import { claimRateLimit } from '../../../../lib/ielts/security';
import { createServiceClient } from '../../../../lib/ielts/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ params, request, cookies }) => {
	try {
		const auth = await getAuthContext(cookies);
		if (!auth) return json({ error: 'unauthorized' }, 401);
		if (!(await claimRateLimit(request, 'material-download', auth.user.id, 90, 60))) return json({ error: 'rate_limited' }, 429);
		const id = params.id || '';
		if (!/^[a-f0-9-]{36}$/i.test(id)) return json({ error: 'invalid_material' }, 400);
		const client = createServiceClient();
		let query = client.from('ielts_materials').select('storage_path, file_name, published').eq('id', id);
		if (auth.role !== 'admin') query = query.eq('published', true);
		const { data, error } = await query.maybeSingle();
		if (error) throw error;
		if (!data) return json({ error: 'not_found' }, 404);
		const signed = await client.storage.from('ielts-materials').createSignedUrl(data.storage_path, 60, { download: data.file_name });
		if (signed.error || !signed.data) throw signed.error || new Error('signed_download_failed');
		return json({ url: signed.data.signedUrl, expiresIn: 60 });
	} catch {
		return json({ error: 'download_unavailable' }, 503);
	}
};
