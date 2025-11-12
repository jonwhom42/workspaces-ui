import type { SupabaseClient } from '@supabase/supabase-js';
import type { Principle } from '../types/db';
import { ensureWorkspaceMembership, type SeedHelperOptions } from './seeds';
import { upsertEmbeddingForItem } from './embeddings';

type CreatePrincipleInput = {
  seedId?: string | null;
  statement: string;
  category?: string | null;
};

export const createPrinciple = async (
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  input: CreatePrincipleInput,
  options?: SeedHelperOptions,
): Promise<Principle> => {
  await ensureWorkspaceMembership(supabase, workspaceId, userId, options);

  const payload = {
    workspace_id: workspaceId,
    seed_id: input.seedId ?? null,
    created_by: userId,
    statement: input.statement,
    category: input.category ?? null,
    active: true,
  };

  const { data, error } = await supabase
    .from('principles')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to create principle');
  }

  await supabase.from('events').insert({
    workspace_id: workspaceId,
    user_id: userId,
    seed_id: input.seedId ?? null,
    type: 'principle_created',
    payload: { principle_id: data.id, seed_id: input.seedId ?? null },
  });

  try {
    await upsertEmbeddingForItem(supabase, {
      workspaceId,
      seedId: input.seedId ?? null,
      itemType: 'principle',
      itemId: data.id,
      text: data.statement,
      metadata: { category: data.category },
    });
  } catch (embeddingError) {
    console.warn('[principles] embedding upsert failed', embeddingError);
  }

  return data as Principle;
};

export const getPrinciplesForSeed = async (
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  seedId: string,
  options?: SeedHelperOptions,
): Promise<Principle[]> => {
  await ensureWorkspaceMembership(supabase, workspaceId, userId, options);
  const { data, error } = await supabase
    .from('principles')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('seed_id', seedId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Principle[];
};
