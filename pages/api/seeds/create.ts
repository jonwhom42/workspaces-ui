import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabase } from '../../../lib/supabaseServer';
import { createSeed } from '../../../lib/seeds';

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

  const { workspaceId, title, summary, whyItMatters, status } = req.body ?? {};

  if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
    return res.status(400).json({ error: 'workspaceId is required' });
  }

  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const seed = await createSeed(supabase, workspaceId, user.id, {
      title: title.trim(),
      summary: typeof summary === 'string' ? summary : undefined,
      whyItMatters: typeof whyItMatters === 'string' ? whyItMatters : undefined,
      status: typeof status === 'string' ? status : undefined,
    });

    return res.status(200).json({ seed });
  } catch (error) {
    console.error('[api/seeds/create] failed', error);
    return res.status(500).json({ error: 'Unable to create seed' });
  }
}
