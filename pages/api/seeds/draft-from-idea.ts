import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabase } from '../../../lib/supabaseServer';
import { getUserWorkspaceById } from '../../../lib/workspaces';
import { draftSeedFromIdea } from '../../../lib/aiClient';

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

  const { workspaceId, ideaText } = req.body ?? {};

  if (typeof workspaceId !== 'string' || !workspaceId) {
    return res.status(400).json({ error: 'workspaceId is required' });
  }

  if (typeof ideaText !== 'string' || !ideaText.trim()) {
    return res.status(400).json({ error: 'ideaText is required' });
  }

  const membership = await getUserWorkspaceById(supabase, user.id, workspaceId);
  if (!membership) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const seedDraft = await draftSeedFromIdea(ideaText);
    return res.status(200).json({ seedDraft });
  } catch (error) {
    console.error('[api/seeds/draft-from-idea] failed', error);
    return res.status(500).json({ error: 'Unable to draft idea' });
  }
}
