import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabase } from '../../../lib/supabaseServer';
import { updateSeed } from '../../../lib/seeds';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createServerSupabase({ req, res });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { workspaceId, seedId, title, summary, whyItMatters, status } = req.body ?? {};

  if (typeof workspaceId !== 'string' || !workspaceId.trim()) {
    return res.status(400).json({ error: 'workspaceId is required' });
  }

  if (typeof seedId !== 'string' || !seedId.trim()) {
    return res.status(400).json({ error: 'seedId is required' });
  }

  if (
    ![
      typeof title === 'string',
      typeof summary === 'string',
      typeof whyItMatters === 'string',
      typeof status === 'string',
    ].some(Boolean)
  ) {
    return res.status(400).json({ error: 'No valid fields provided' });
  }

  try {
    const seed = await updateSeed(
      supabase,
      workspaceId,
      user.id,
      seedId,
      {
        title: typeof title === 'string' ? title : undefined,
        summary: typeof summary === 'string' ? summary : undefined,
        whyItMatters: typeof whyItMatters === 'string' ? whyItMatters : undefined,
        status: typeof status === 'string' ? status : undefined,
      },
      {},
    );
    return res.status(200).json({ seed });
  } catch (error) {
    console.error('[api/seeds/update] failed', error);
    return res.status(500).json({ error: 'Unable to update seed' });
  }
}
