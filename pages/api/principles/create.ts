import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabase } from '../../../lib/supabaseServer';
import { createPrinciple } from '../../../lib/principles';

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

  const { workspaceId, seedId, statement, category } = req.body ?? {};

  if (typeof workspaceId !== 'string' || !workspaceId.trim()) {
    return res.status(400).json({ error: 'workspaceId is required' });
  }

  if (typeof seedId !== 'string' || !seedId.trim()) {
    return res.status(400).json({ error: 'seedId is required' });
  }

  if (typeof statement !== 'string' || !statement.trim()) {
    return res.status(400).json({ error: 'statement is required' });
  }

  try {
    const principle = await createPrinciple(
      supabase,
      workspaceId,
      user.id,
      {
        seedId,
        statement: statement.trim(),
        category: typeof category === 'string' && category.trim() ? category.trim() : null,
      },
      {},
    );

    return res.status(200).json({ principle });
  } catch (error) {
    console.error('[api/principles/create] failed', error);
    return res.status(500).json({ error: 'Unable to create principle' });
  }
}
