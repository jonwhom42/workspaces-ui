import { createSupabaseServerClient, getSupabaseServiceRoleClient } from '../../../lib/supabaseServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabaseServer = createSupabaseServerClient(req, res);
  const {
    data: { user },
    error: userError,
  } = await supabaseServer.auth.getUser();

  if (userError || !user) {
    console.error('[api/workspaces/create] Invalid session', userError);
    return res.status(401).json({ error: 'Invalid session' });
  }

  const { name } = req.body || {};

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Workspace name is required' });
  }
  if (process.env.NODE_ENV !== 'production') {
    console.log('[api/workspaces/create] Creating workspace for user', user.id, name);
  }

  const supabaseAdmin = getSupabaseServiceRoleClient();
  const { data: workspace, error: workspaceError } = await supabaseAdmin
    .from('workspaces')
    .insert({ name, created_by: user.id })
    .select('*')
    .single();

  if (workspaceError || !workspace) {
    return res.status(500).json({ error: workspaceError?.message || 'Unable to create workspace' });
  }

  const { error: membershipError } = await supabaseAdmin.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: 'owner',
  });

  if (membershipError) {
    return res
      .status(500)
      .json({ error: membershipError.message || 'Unable to provision workspace membership' });
  }

  return res.status(200).json({ workspace });
}
