import { createSupabaseServerClient } from '../../../lib/supabaseServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
  } = req.body || {};

  if (!accessToken || !refreshToken) {
    return res.status(400).json({ error: 'access_token and refresh_token are required' });
  }

  const supabase = createSupabaseServerClient(req, res);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[auth/set-cookie] Validating session payload');
  }
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
  });

  if (error || !data?.session) {
    console.error('[auth/set-cookie] Invalid session', error);
    return res.status(401).json({ error: error?.message || 'Invalid session' });
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[auth/set-cookie] Session persisted for user', data.session.user?.id);
  }

  return res.status(200).json({ success: true, user: data.session.user });
}
