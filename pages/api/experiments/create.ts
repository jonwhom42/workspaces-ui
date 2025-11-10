import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabase } from '../../../lib/supabaseServer';
import { createExperiment } from '../../../lib/experiments';

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

  const { workspaceId, seedId, title, hypothesis, plan } = req.body ?? {};

  if (typeof workspaceId !== 'string' || !workspaceId) {
    return res.status(400).json({ error: 'workspaceId is required' });
  }

  if (typeof seedId !== 'string' || !seedId) {
    return res.status(400).json({ error: 'seedId is required' });
  }

  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const experiment = await createExperiment(
      supabase,
      workspaceId,
      user.id,
      {
        seedId,
        title: title.trim(),
        hypothesis: typeof hypothesis === 'string' ? hypothesis : null,
        plan: typeof plan === 'string' ? plan : null,
      },
      {},
    );

    return res.status(200).json({ experiment });
  } catch (error) {
    console.error('[api/experiments/create] failed', error);
    return res.status(500).json({ error: 'Unable to create experiment' });
  }
}
