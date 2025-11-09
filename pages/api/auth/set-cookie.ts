import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabase } from '../../../lib/supabaseServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { access_token: accessToken, refresh_token: refreshToken } = req.body || {};

  if (!accessToken || !refreshToken) {
    return res.status(400).json({ error: 'access_token and refresh_token are required' });
  }

  const supabase = createServerSupabase({ req, res });
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data?.session) {
    return res.status(401).json({ error: error?.message || 'Invalid session' });
  }

  return res.status(200).json({ success: true, user: data.session.user });
}
