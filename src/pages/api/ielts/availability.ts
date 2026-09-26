import type { APIRoute } from 'astro';
import { json } from '../../../lib/ielts/http';
import { claimRateLimit } from '../../../lib/ielts/security';
import { createServiceClient } from '../../../lib/ielts/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	try {
		if (!(await claimRateLimit(request, 'availability', '', 120, 60))) return json({ error: 'rate_limited' }, 429);
		const url = new URL(request.url);
		const month = url.searchParams.get('month') || '';
		if (!/^\d{4}-\d{2}$/.test(month)) return json({ error: 'invalid_month' }, 400);
		const start = `${month}-01`;
		const next = new Date(`${start}T00:00:00Z`);
		if (Number.isNaN(next.getTime()) || next.toISOString().slice(0, 7) !== month) return json({ error: 'invalid_month' }, 400);
		next.setUTCMonth(next.getUTCMonth() + 1);
		const end = next.toISOString().slice(0, 10);
		const { data, error } = await createServiceClient().from('ielts_bookings')
			.select('lesson_date, lesson_time')
			.gte('lesson_date', start)
			.lt('lesson_date', end)
			.neq('lesson_time', '其他时间')
			.in('status', ['pending', 'confirmed']);
		if (error) throw error;
		return json({ unavailable: data || [] });
	} catch {
		return json({ error: 'availability_unavailable' }, 503);
	}
};
