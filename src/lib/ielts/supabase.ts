import { createClient } from '@supabase/supabase-js';
import { ieltsConfig } from './config';

const options = {
	auth: {
		autoRefreshToken: false,
		persistSession: false,
		detectSessionInUrl: false,
	},
};

export const createPublicClient = () => {
	const config = ieltsConfig();
	return createClient(config.supabaseUrl, config.publicKey, options);
};

export const createServiceClient = () => {
	const config = ieltsConfig();
	return createClient(config.supabaseUrl, config.secretKey, options);
};
