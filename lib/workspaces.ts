import type { SupabaseClient } from '@supabase/supabase-js';
import type { Workspace, WorkspaceMemberRole } from '../types/db';

export type WorkspaceWithRole = Workspace & { role: WorkspaceMemberRole };

export const LAST_WORKSPACE_COOKIE = 'oo-last-workspace';

export const getUserWorkspaces = async (
  client: SupabaseClient,
  userId: string,
): Promise<WorkspaceWithRole[]> => {
  if (!userId) {
    return [];
  }

  const { data, error } = await client
    .from('workspace_members')
    .select(
      `
      role,
      workspaces:workspaces (
        id,
        name,
        created_by,
        created_at
      )
    `,
    )
    .eq('user_id', userId)
    .order('created_at', { referencedTable: 'workspaces', ascending: true });

  if (error) {
    throw error;
  }

  return (
    data?.map((entry: any) => ({
      ...((entry.workspaces as unknown) as Workspace),
      role: entry.role as WorkspaceMemberRole,
    })) ?? []
  );
};

export const getWorkspaceForUser = async (
  client: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceWithRole | null> => {
  const { data, error } = await client
    .from('workspace_members')
    .select(
      `
      role,
      workspaces:workspaces (
        id,
        name,
        created_by,
        created_at
      )
    `,
    )
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    ...((data.workspaces as unknown) as Workspace),
    role: data.role as WorkspaceMemberRole,
  };
};

export const createWorkspaceWithOwner = async (
  client: SupabaseClient,
  userId: string,
  name: string,
): Promise<Workspace> => {
  const { data, error } = await client
    .from('workspaces')
    .insert({ name, created_by: userId })
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to create workspace');
  }

  const { error: membershipError } = await client.from('workspace_members').insert({
    workspace_id: data.id,
    user_id: userId,
    role: 'owner',
  });

  if (membershipError) {
    throw membershipError;
  }

  return data as Workspace;
};
