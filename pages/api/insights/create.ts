import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabase } from '../../../lib/supabaseServer';
import { createInsight } from '../../../lib/insights';

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

  const { workspaceId, seedId, summary, details } = req.body ?? {};

  if (typeof workspaceId !== 'string' || !workspaceId) {
    return res.status(400).json({ error: 'workspaceId is required' });
  }

  if (typeof summary !== 'string' || !summary.trim()) {
    return res.status(400).json({ error: 'summary is required' });
  }

  try {
    const insight = await createInsight(
      supabase,
      workspaceId,
      user.id,
      {
        seedId: typeof seedId === 'string' ? seedId : null,
        summary: summary.trim(),
        details: typeof details === 'string' ? details : null,
        sourceType: 'copilot',
      },
      {},
    );
    return res.status(200).json({ insight });
  } catch (error) {
    console.error('[api/insights/create] failed', error);
    return res.status(500).json({ error: 'Unable to create insight' });
  }
}
