import type { SupabaseClient } from '@supabase/supabase-js';
import type { Seed } from '../types/db';
import { getUserWorkspaceById } from './workspaces';

type CreateSeedInput = {
  title: string;
  summary?: string;
  whyItMatters?: string;
  status?: string;
};

export type SeedHelperOptions = {
  fallbackClient?: SupabaseClient;
};

export const ensureWorkspaceMembership = async (
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  options?: SeedHelperOptions,
) => {
  const membership = await getUserWorkspaceById(supabase, userId, workspaceId, {
    fallbackClient: options?.fallbackClient,
  });
  if (!membership) {
    throw new Error('Workspace not found or unauthorized');
  }
};

export const getSeedsForWorkspace = async (
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  options?: SeedHelperOptions,
): Promise<Seed[]> => {
  await ensureWorkspaceMembership(supabase, workspaceId, userId, options);
  const { data, error } = await supabase
    .from('seeds')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data as Seed[];
};

export const getSeedById = async (
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  seedId: string,
  options?: SeedHelperOptions,
): Promise<Seed | null> => {
  await ensureWorkspaceMembership(supabase, workspaceId, userId, options);
  const { data, error } = await supabase
    .from('seeds')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('id', seedId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return (data as Seed) ?? null;
};

export const createSeed = async (
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  input: CreateSeedInput,
  options?: SeedHelperOptions,
): Promise<Seed> => {
  await ensureWorkspaceMembership(supabase, workspaceId, userId, options);
  const payload = {
    workspace_id: workspaceId,
    created_by: userId,
    title: input.title,
    summary: input.summary ?? null,
    why_it_matters: input.whyItMatters ?? null,
    status: input.status ?? 'germinating',
  };

  const { data, error } = await supabase.from('seeds').insert(payload).select('*').single();

  if (error || !data) {
    throw error ?? new Error('Unable to create seed');
  }

  await supabase.from('events').insert({
    workspace_id: workspaceId,
    user_id: userId,
    seed_id: data.id,
    type: 'seed_created',
    payload: { seed_id: data.id, title: input.title },
  });

  return data as Seed;
};
