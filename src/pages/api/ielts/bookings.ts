import type { APIRoute } from 'astro';
import { getAuthContext } from '../../../lib/ielts/auth';
import { sendBookingEmails } from '../../../lib/ielts/email';
import { cleanLine, cleanText, json, readJson, sameOrigin } from '../../../lib/ielts/http';
import { claimRateLimit } from '../../../lib/ielts/security';
import { createServiceClient } from '../../../lib/ielts/supabase';
import { isBookableDate } from '../../../lib/ielts/booking-window';

export const prerender = false;

const slots = new Set(['8:30–10:00', '10:30–12:00', '19:00–20:30', '21:00–22:30', '其他时间']);
const subjects = new Set(['听力', '阅读', '写作', '口语']);
const customTimePrefix = '@requested-time:';
type BookingRecord = Record<string, unknown> & {
	id?: unknown;
	lesson_date?: unknown;
	lesson_time?: unknown;
	lesson_subject?: unknown;
	notes?: unknown;
	status?: unknown;
	created_at?: unknown;
};

const unpackNotes = (booking: BookingRecord) => {
	const notes = String(booking.notes || '');
	if (booking.lesson_time !== '其他时间' || !notes.startsWith(customTimePrefix)) return { ...booking, lesson_time_note: '', notes };
	const separator = notes.indexOf('\n');
	const lessonTimeNote = notes.slice(customTimePrefix.length, separator < 0 ? undefined : separator);
	return { ...booking, lesson_time_note: lessonTimeNote, notes: separator < 0 ? '' : notes.slice(separator + 1) };
};

export const GET: APIRoute = async ({ request, cookies }) => {
	try {
		const auth = await getAuthContext(cookies);
		if (!auth) return json({ error: 'unauthorized' }, 401);
		const mineOnly = new URL(request.url).searchParams.get('scope') === 'mine';
		const adminView = auth.role === 'admin' && !mineOnly;
		let query = createServiceClient().from('ielts_bookings')
			.select('id, email, name, contact, lesson_date, lesson_time, lesson_subject, notes, status, created_at')
			.order('created_at', { ascending: false })
			.limit(20);
		if (!adminView) query = query.eq('user_id', auth.user.id);
		const { data, error } = await query;
		if (error) throw error;
		const bookings = (data || []).map((booking) => unpackNotes(booking as unknown as BookingRecord));
		return json({ bookings: adminView ? bookings : bookings.map((booking) => ({
			id: booking.id,
			lesson_date: booking.lesson_date,
			lesson_time: booking.lesson_time,
			lesson_time_note: booking.lesson_time_note,
			lesson_subject: booking.lesson_subject,
			status: booking.status,
			created_at: booking.created_at,
		})) });
	} catch {
		return json({ error: 'bookings_unavailable' }, 503);
	}
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
	if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
	try {
		const auth = await getAuthContext(cookies);
		if (!auth) return json({ error: 'unauthorized' }, 401);
		if (!(await claimRateLimit(request, 'booking-update', auth.user.id, 20, 3600, 'identity'))) return json({ error: 'rate_limited' }, 429);
		const body = await readJson<Record<string, unknown>>(request);
		const id = String(body.id || '');
		const action = String(body.action || 'cancel');
		if (!/^[a-f0-9-]{36}$/i.test(id) || !['cancel', 'confirm'].includes(action)) return json({ error: 'invalid_booking' }, 400);
		if (action === 'confirm' && auth.role !== 'admin') return json({ error: 'forbidden' }, 403);
		const client = createServiceClient();
		const { data: existing, error: lookupError } = await client.from('ielts_bookings')
			.select('id, user_id, email, status')
			.eq('id', id)
			.maybeSingle();
		if (lookupError) throw lookupError;
		if (!existing) return json({ error: 'booking_not_found' }, 404);
		const ownsBooking = existing.user_id === auth.user.id || String(existing.email).trim().toLowerCase() === auth.email;
		if (auth.role !== 'admin' && !ownsBooking) return json({ error: 'forbidden' }, 403);
		const allowedStatuses = action === 'confirm' ? ['pending'] : ['pending', 'confirmed'];
		if (!allowedStatuses.includes(existing.status)) return json({ error: 'booking_not_active' }, 409);
		const nextStatus = action === 'confirm' ? 'confirmed' : 'cancelled';
		const { data, error } = await client.from('ielts_bookings')
			.update({ status: nextStatus, updated_at: new Date().toISOString() })
			.eq('id', id)
			.eq('status', existing.status)
			.select('id, status')
			.maybeSingle();
		if (error) throw error;
		if (!data) return json({ error: 'booking_changed' }, 409);
		return json({ ok: true, booking: data });
	} catch (error) {
		if (error instanceof Error && ['invalid_content_type', 'payload_too_large'].includes(error.message)) return json({ error: error.message }, 400);
		return json({ error: 'booking_unavailable' }, 503);
	}
};

export const POST: APIRoute = async ({ request, cookies }) => {
	if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
	try {
		const auth = await getAuthContext(cookies);
		if (!auth) return json({ error: 'unauthorized' }, 401);
		if (!(await claimRateLimit(request, 'booking-user', auth.user.id, 5, 86400, 'identity'))
			|| !(await claimRateLimit(request, 'booking-ip', '', 20, 86400, 'request'))) return json({ error: 'rate_limited' }, 429);
		const body = await readJson<Record<string, unknown>>(request);
		const name = cleanLine(body.name, 60);
		const contact = cleanLine(body.contact, 120);
		const notes = cleanText(body.notes, 400);
		const consent = body.consent === true;
		const requested = Array.isArray(body.bookings) ? body.bookings : [body];
		if (!name || !consent || requested.length < 1 || requested.length > 4) return json({ error: 'invalid_booking' }, 400);
		const seen = new Set<string>();
		const prepared = requested.map((value) => {
			const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
			const date = String(item.date || '');
			const time = String(item.time || '');
			const customTime = time === '其他时间' ? cleanLine(item.customTime, 80) : '';
			const subject = String(item.subject || '');
			const key = `${date}|${time}|${customTime}`;
			if (!subjects.has(subject) || !isBookableDate(date) || !slots.has(time) || (time === '其他时间' && customTime.length < 2) || seen.has(key)) throw new Error('invalid_booking');
			seen.add(key);
			return { date, time, customTime, subject, storedNotes: customTime ? `${customTimePrefix}${customTime}\n${notes}` : notes };
		});
		const client = createServiceClient();
		const { data, error } = await client.from('ielts_bookings').insert(prepared.map((item) => ({
			user_id: auth.user.id,
			email: auth.email,
			name,
			contact,
			lesson_date: item.date,
			lesson_time: item.time,
			lesson_subject: item.subject,
			notes: item.storedNotes,
		}))).select('id, lesson_date, lesson_time, lesson_subject, status');
		if (error?.code === '23505') return json({ error: 'slot_unavailable' }, 409);
		if (error || !data || data.length !== prepared.length) throw error || new Error('booking_insert_failed');
		const emailSent = await sendBookingEmails({
			email: auth.email,
			name,
			contact,
			notes,
			bookings: data.map((item, index) => ({
				id: item.id,
				date: prepared[index].date,
				time: prepared[index].customTime ? `其他时间：${prepared[index].customTime}` : prepared[index].time,
				subject: prepared[index].subject,
			})),
		});
		return json({ ok: true, bookings: data.map((item, index) => ({ ...item, lesson_time_note: prepared[index].customTime })), emailSent }, 201);
	} catch (error) {
		if (error instanceof Error && error.message === 'invalid_booking') return json({ error: 'invalid_booking' }, 400);
		if (error instanceof Error && ['invalid_content_type', 'payload_too_large'].includes(error.message)) return json({ error: error.message }, 400);
		return json({ error: 'booking_unavailable' }, 503);
	}
};
