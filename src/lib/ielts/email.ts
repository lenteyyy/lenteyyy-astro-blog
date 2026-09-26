import { Resend } from 'resend';
import { ieltsConfig } from './config';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);

const sender = () => {
	const config = ieltsConfig();
	return `冷踢踢 IELTS <notice@${config.resendDomain}>`;
};

const client = () => new Resend(ieltsConfig().resendKey);
const supportEmail = 'lenteywang@gmail.com';
const securityNotice = '基于保安要求并为了保证服务质素，请勿回复此电子邮件，也请勿点击任何来源不明之网页和附件。';

export async function sendLoginCode(to: string, code: string): Promise<void> {
	const text = `您好，非常感谢您申请注册冷踢踢 IELTS 或申请重设密码。以下为您的六位验证码：\n${code}\n\n此验证码于 15 分钟内有效，请及时输入。如非本人操作，请忽略本电子邮件或发送咨询邮件至 ${supportEmail}\n\n${securityNotice}`;
	const { error } = await client().emails.send({
		from: sender(),
		to,
		subject: '冷踢踢 IELTS 的 验证码',
		text,
		html: `<div style="font-family:Arial,sans-serif;color:#102a49;line-height:1.8;max-width:640px"><p>您好，非常感谢您申请注册冷踢踢 IELTS 或申请重设密码。以下为您的六位验证码：</p><p style="font-size:32px;font-weight:700;letter-spacing:.18em">${escapeHtml(code)}</p><p>此验证码于 15 分钟内有效，请及时输入。如非本人操作，请忽略本电子邮件或发送咨询邮件至 <a href="mailto:${supportEmail}">${supportEmail}</a></p><p>${securityNotice}</p></div>`,
		headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
	});
	if (error) throw new Error('email_delivery_failed');
}

type BookingMail = { id: string; email: string; name: string; contact: string; date: string; time: string; subject: string; notes: string };

export async function sendBookingEmails(booking: BookingMail): Promise<boolean> {
	const config = ieltsConfig();
	const details = `称呼：${booking.name}\n邮箱：${booking.email}\n其他联系方式：${booking.contact || '无'}\n日期：${booking.date}\n时间：${booking.time}\n科目：${booking.subject}\n补充：${booking.notes || '无'}`;
	const safeDetails = escapeHtml(details).replace(/\n/g, '<br>');
	const studentText = `${booking.name}，谢谢您的预约！我们已经收到您的预约意向。待确认时间后会再次联系您。\n\n${details}\n\n如非本人操作，请忽略本电子邮件或发送咨询邮件至 ${supportEmail}\n\n${securityNotice}`;
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
			subject: `${booking.name}，已收到您的 IELTS 课程预约`,
			text: studentText,
			html: `<div style="font-family:Arial,sans-serif;line-height:1.8;max-width:640px"><p>${escapeHtml(booking.name)}，谢谢您的预约！我们已经收到您的预约意向。待确认时间后会再次联系您。</p><p>${safeDetails}</p><p>如非本人操作，请忽略本电子邮件或发送咨询邮件至 <a href="mailto:${supportEmail}">${supportEmail}</a></p><p>${securityNotice}</p></div>`,
			headers: { 'X-Entity-Ref-ID': `${booking.id}-student` },
		}),
	];
	const results = await Promise.allSettled(requests);
	return results.every((result) => result.status === 'fulfilled' && !result.value.error);
}
