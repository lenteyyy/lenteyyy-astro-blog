import type { APIRoute } from 'astro';
import { getAuthContext } from '../../../lib/ielts/auth';
import { sendBookingEmails } from '../../../lib/ielts/email';
import { cleanText, json, readJson, sameOrigin } from '../../../lib/ielts/http';
import { claimRateLimit } from '../../../lib/ielts/security';
import { createServiceClient } from '../../../lib/ielts/supabase';

export const prerender = false;

const slots = new Set(['10:30–11:30', '14:00–15:00', '16:00–17:00', '20:00–21:00']);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const localDate = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const localToday = () => localDate(new Date());

export const GET: APIRoute = async ({ cookies }) => {
	try {
		const auth = await getAuthContext(cookies);
		if (!auth) return json({ error: 'unauthorized' }, 401);
		let query = createServiceClient().from('ielts_bookings')
			.select('id, lesson_date, lesson_time, status, created_at')
			.order('created_at', { ascending: false })
			.limit(20);
		if (auth.role !== 'admin') query = query.eq('user_id', auth.user.id);
		const { data, error } = await query;
		if (error) throw error;
		return json({ bookings: data || [] });
	} catch {
		return json({ error: 'bookings_unavailable' }, 503);
	}
};

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
	try {
		const auth = await getAuthContext(cookies);
		if (!auth) return json({ error: 'unauthorized' }, 401);
		if (!(await claimRateLimit(request, 'booking', auth.user.id, 5, 86400))) return json({ error: 'rate_limited' }, 429);
		const body = await readJson<Record<string, unknown>>(request);
		const name = cleanText(body.name, 60);
		const contact = cleanText(body.contact, 120);
		const notes = cleanText(body.notes, 500);
		const date = String(body.date || '');
		const time = String(body.time || '');
		const consent = body.consent === true;
		const parsedDate = new Date(`${date}T00:00:00+08:00`);
		const latest = new Date(); latest.setDate(latest.getDate() + 180);
		if (!name || !consent || !datePattern.test(date) || !slots.has(time) || Number.isNaN(parsedDate.getTime()) || localDate(parsedDate) !== date || date < localToday() || date > localDate(latest)) {
			return json({ error: 'invalid_booking' }, 400);
		}
		const client = createServiceClient();
		const { data, error } = await client.from('ielts_bookings').insert({
			user_id: auth.user.id,
			email: auth.email,
			name,
			contact,
			lesson_date: date,
			lesson_time: time,
			notes,
		}).select('id, lesson_date, lesson_time, status').single();
		if (error?.code === '23505') return json({ error: 'slot_unavailable' }, 409);
		if (error || !data) throw error || new Error('booking_insert_failed');
		const emailSent = await sendBookingEmails({ id: data.id, email: auth.email, name, contact, date, time, notes });
		return json({ ok: true, booking: data, emailSent }, 201);
	} catch (error) {
		if (error instanceof Error && ['invalid_content_type', 'payload_too_large'].includes(error.message)) return json({ error: error.message }, 400);
		return json({ error: 'booking_unavailable' }, 503);
	}
};
