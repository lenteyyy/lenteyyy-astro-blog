const required = (name: string, value: string | undefined): string => {
	if (!value) throw new Error(`Missing server configuration: ${name}`);
	return value;
};

export const ieltsConfig = () => ({
	supabaseUrl: required('SUPABASE_URL', import.meta.env.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL),
	publicKey: required('SUPABASE_PUBLISHABLE_KEY', import.meta.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.SUPABASE_ANON_KEY),
	secretKey: required('SUPABASE_SECRET_KEY', import.meta.env.SUPABASE_SECRET_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY),
	resendKey: required('RESEND_API_KEY', import.meta.env.RESEND_API_KEY),
	resendDomain: import.meta.env.RESEND_EMAIL_DOMAIN || 'lenteyyy.com',
	adminEmail: (import.meta.env.IELTS_ADMIN_EMAIL || 'lenteyteytey@gmail.com').trim().toLowerCase(),
});

export const isAdminEmail = (email: string | undefined): boolean => {
	if (!email) return false;
	return email.trim().toLowerCase() === ieltsConfig().adminEmail;
};
