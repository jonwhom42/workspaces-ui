import { serialize } from 'cookie';
import { createSupabaseServerClient } from '../../../lib/supabaseServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabase = createSupabaseServerClient(req, res);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[auth/logout] Signing out current session');
  }
  await supabase.auth.signOut();
  return res.status(200).json({ success: true });
}
