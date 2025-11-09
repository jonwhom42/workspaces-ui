const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}

const projectRef = new URL(supabaseUrl).hostname.split('.')[0];

export const AUTH_COOKIE_NAME = `sb-${projectRef}-auth-token`;
export const REFRESH_COOKIE_NAME = `sb-${projectRef}-refresh-token`;
