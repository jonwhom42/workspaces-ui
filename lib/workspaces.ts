import type { SupabaseClient } from '@supabase/supabase-js';
import type { Workspace, WorkspaceMemberRole } from '../types/db';

/**
 * All workspace-aware reads MUST go through helpers in this file.
 * Every workspace-bound table is required to include a workspace_id column and
 * Row Level Security ensures auth.uid() is a member of that workspace.
 */
export type WorkspaceWithRole = Workspace & { role: WorkspaceMemberRole };

export const LAST_WORKSPACE_COOKIE = 'oo-last-workspace';

const workspaceSelection = `
  role,
  workspaces:workspaces (
    id,
    name,
    created_by,
    created_at
  )
`;

const mapEntryToWorkspace = (entry: Record<string, unknown>): WorkspaceWithRole => {
  const workspace = entry.workspaces as Workspace;
  return {
    ...workspace,
    role: entry.role as WorkspaceMemberRole,
  };
};

type WorkspaceFetchOptions = {
  fallbackClient?: SupabaseClient;
};

const fetchWorkspaceMemberships = async (client: SupabaseClient, userId: string) => {
  return client
    .from('workspace_members')
    .select(workspaceSelection)
    .eq('user_id', userId)
    .order('created_at', { referencedTable: 'workspaces', ascending: true });
};

export const getUserWorkspaces = async (
  client: SupabaseClient,
  userId: string,
  options?: WorkspaceFetchOptions,
): Promise<WorkspaceWithRole[]> => {
  if (!userId) {
    return [];
  }

  const { data, error } = await fetchWorkspaceMemberships(client, userId);

  if (error) {
    throw error;
  }

  if (data && data.length > 0) {
    return data.map(mapEntryToWorkspace);
  }

  if (options?.fallbackClient) {
    const { data: fallbackData, error: fallbackError } = await fetchWorkspaceMemberships(
      options.fallbackClient,
      userId,
    );

    if (fallbackError) {
      throw fallbackError;
    }

    if (fallbackData && fallbackData.length > 0) {
      console.warn('[workspaces] RLS fallback used to load workspaces', {
        userId,
        count: fallbackData.length,
      });
      return fallbackData.map(mapEntryToWorkspace);
    }
  }

  return [];
};

export const getUserWorkspaceById = async (
  client: SupabaseClient,
  userId: string,
  workspaceId: string,
  options?: WorkspaceFetchOptions,
): Promise<WorkspaceWithRole | null> => {
  if (!workspaceId || !userId) {
    return null;
  }

  const { data, error } = await client
    .from('workspace_members')
    .select(workspaceSelection)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (data) {
    return mapEntryToWorkspace(data as Record<string, unknown>);
  }

  if (options?.fallbackClient) {
    const { data: fallbackData, error: fallbackError } = await options.fallbackClient
      .from('workspace_members')
      .select(workspaceSelection)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle();

    if (fallbackError && fallbackError.code !== 'PGRST116') {
      throw fallbackError;
    }

    if (fallbackData) {
      console.warn('[workspaces] RLS fallback used to load workspace by id', {
        userId,
        workspaceId,
      });
      return mapEntryToWorkspace(fallbackData as Record<string, unknown>);
    }
  }

  return null;
};

export const getWorkspaceContext = async (
  client: SupabaseClient,
  userId: string,
  workspaceId: string,
  options?: WorkspaceFetchOptions,
): Promise<{ workspace: WorkspaceWithRole | null; workspaces: WorkspaceWithRole[] }> => {
  const [workspace, workspaces] = await Promise.all([
    getUserWorkspaceById(client, userId, workspaceId, options),
    getUserWorkspaces(client, userId, options),
  ]);
  return { workspace, workspaces };
};

export const createWorkspaceWithOwner = async (
  client: SupabaseClient,
  userId: string,
  name: string,
): Promise<Workspace> => {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Workspace name is required');
  }

  const { data: workspace, error } = await client
    .from('workspaces')
    .insert({ name: trimmed, created_by: userId })
    .select('*')
    .single();

  if (error || !workspace) {
    throw error ?? new Error('Failed to create workspace');
  }

  const { error: membershipError } = await client
    .from('workspace_members')
    .insert({ workspace_id: workspace.id, user_id: userId, role: 'owner' })
    .select('workspace_id')
    .single();

  if (membershipError) {
    await client.from('workspaces').delete().eq('id', workspace.id);
    throw membershipError;
  }

  return workspace as Workspace;
};
