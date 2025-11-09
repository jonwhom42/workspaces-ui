import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabase, getSupabaseServiceRoleClient } from '../../../lib/supabaseServer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabase = createServerSupabase({ req, res });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const { name } = req.body ?? {};
  if (typeof name !== 'string') {
    return res.status(400).json({ error: 'Workspace name is required' });
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return res.status(400).json({ error: 'Workspace name cannot be empty' });
  }
  if (trimmedName.length > 80) {
    return res.status(400).json({ error: 'Workspace name must be 80 characters or fewer' });
  }

  const serviceRole = getSupabaseServiceRoleClient();

  const { data: workspace, error: workspaceError } = await serviceRole
    .from('workspaces')
    .insert({ name: trimmedName, created_by: user.id })
    .select('id')
    .single();

  if (workspaceError || !workspace) {
    const status =
      workspaceError?.code && workspaceError.code.startsWith('22') ? 400 : 500;
    return res.status(status).json({
      error: workspaceError?.message || 'Unable to create workspace',
    });
  }

  const { error: membershipError } = await serviceRole
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: 'owner',
    })
    .select('workspace_id')
    .single();

  if (membershipError) {
    await serviceRole.from('workspaces').delete().eq('id', workspace.id);
    return res.status(500).json({
      error: membershipError.message || 'Unable to provision workspace membership',
    });
  }

  return res.status(200).json({ workspaceId: workspace.id });
}
