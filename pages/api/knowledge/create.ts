import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabase } from '../../../lib/supabaseServer';
import { createKnowledgeItem } from '../../../lib/knowledge';

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

  const { workspaceId, seedId, type, title, content, sourceUrl } = req.body ?? {};

  if (typeof workspaceId !== 'string' || !workspaceId) {
    return res.status(400).json({ error: 'workspaceId is required' });
  }

  if (typeof seedId !== 'string' || !seedId) {
    return res.status(400).json({ error: 'seedId is required' });
  }

  if (typeof type !== 'string' || !type) {
    return res.status(400).json({ error: 'type is required' });
  }

  try {
    const item = await createKnowledgeItem(supabase, workspaceId, user.id, {
      seedId,
      type,
      title: typeof title === 'string' ? title : undefined,
      content: typeof content === 'string' ? content : undefined,
      sourceUrl: typeof sourceUrl === 'string' ? sourceUrl : undefined,
    });

    return res.status(200).json({ knowledge: item });
  } catch (error) {
    console.error('[api/knowledge/create] failed', error);
    return res.status(500).json({ error: 'Unable to create knowledge item' });
  }
}
