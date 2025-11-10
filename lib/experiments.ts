import type { SupabaseClient } from '@supabase/supabase-js';
import type { Experiment } from '../types/db';
import { getUserWorkspaceById } from './workspaces';

type ExperimentHelperOptions = {
  fallbackClient?: SupabaseClient;
};

const ensureMembership = async (
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  options?: ExperimentHelperOptions,
) => {
  const membership = await getUserWorkspaceById(supabase, userId, workspaceId, {
    fallbackClient: options?.fallbackClient,
  });
  if (!membership) {
    throw new Error('Workspace not found or unauthorized');
  }
};

export const getExperimentsForSeed = async (
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  seedId: string,
  options?: ExperimentHelperOptions,
): Promise<Experiment[]> => {
  await ensureMembership(supabase, workspaceId, userId, options);
  const { data, error } = await supabase
    .from('experiments')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('seed_id', seedId)
    .order('created_at', { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []) as Experiment[];
};

type CreateExperimentInput = {
  seedId: string;
  title: string;
  hypothesis?: string | null;
  plan?: string | null;
  status?: string;
};

export const createExperiment = async (
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  input: CreateExperimentInput,
  options?: ExperimentHelperOptions,
): Promise<Experiment> => {
  await ensureMembership(supabase, workspaceId, userId, options);

  const payload = {
    workspace_id: workspaceId,
    seed_id: input.seedId,
    created_by: userId,
    title: input.title,
    hypothesis: input.hypothesis ?? null,
    plan: input.plan ?? null,
    status: input.status ?? 'planned',
  };

  const { data, error } = await supabase.from('experiments').insert(payload).select('*').single();
  if (error || !data) {
    throw error ?? new Error('Unable to create experiment');
  }

  await supabase.from('events').insert({
    workspace_id: workspaceId,
    user_id: userId,
    seed_id: input.seedId,
    type: 'experiment_created',
    payload: { experiment_id: data.id },
  });

  return data as Experiment;
};
