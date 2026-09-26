import { Resend } from 'resend';
import { ieltsConfig } from './config';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);

const sender = () => {
	const config = ieltsConfig();
	return `Lenteyyy IELTS <notice@${config.resendDomain}>`;
};

const client = () => new Resend(ieltsConfig().resendKey);

export async function sendLoginCode(to: string, code: string): Promise<void> {
	const { error } = await client().emails.send({
		from: sender(),
		to,
		subject: 'Lenteyyy IELTS 密码验证',
		text: `你的六位验证码是 ${code}，15 分钟内有效。验证码用于设置或重设密码；如非本人操作，请忽略本邮件。`,
		html: `<div style="font-family:Arial,sans-serif;color:#102a49;line-height:1.7"><p>你的六位验证码是：</p><p style="font-size:32px;font-weight:700;letter-spacing:.18em">${escapeHtml(code)}</p><p>15 分钟内有效，用于设置或重设密码。如非本人操作，请忽略本邮件。</p></div>`,
		headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
	});
	if (error) throw new Error('email_delivery_failed');
}

type BookingMail = { id: string; email: string; name: string; contact: string; date: string; time: string; notes: string };

export async function sendBookingEmails(booking: BookingMail): Promise<boolean> {
	const config = ieltsConfig();
	const details = `称呼：${booking.name}\n邮箱：${booking.email}\n其他联系方式：${booking.contact || '无'}\n日期：${booking.date}\n时间：${booking.time}\n补充：${booking.notes || '无'}`;
	const safeDetails = escapeHtml(details).replace(/\n/g, '<br>');
	const requests = [
		client().emails.send({
			from: sender(),
			to: config.adminEmail,
			replyTo: booking.email,
			subject: `IELTS 课程预约 · ${booking.date} ${booking.time}`,
			text: details,
			html: `<div style="font-family:Arial,sans-serif;line-height:1.7"><h2>新的课程预约</h2><p>${safeDetails}</p></div>`,
			headers: { 'X-Entity-Ref-ID': `${booking.id}-admin` },
		}),
		client().emails.send({
			from: sender(),
			to: booking.email,
			replyTo: config.adminEmail,
			subject: '已收到你的 IELTS 课程预约',
			text: `已收到你的预约意向，最终时间以邮件确认为准。\n\n${details}`,
			html: `<div style="font-family:Arial,sans-serif;line-height:1.7"><h2>已收到预约意向</h2><p>最终时间以邮件确认为准。</p><p>${safeDetails}</p></div>`,
			headers: { 'X-Entity-Ref-ID': `${booking.id}-student` },
		}),
	];
	const results = await Promise.allSettled(requests);
	return results.every((result) => result.status === 'fulfilled' && !result.value.error);
}
