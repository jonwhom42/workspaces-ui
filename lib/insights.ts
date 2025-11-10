import type { SupabaseClient } from '@supabase/supabase-js';
import type { Insight } from '../types/db';
import { ensureWorkspaceMembership, type SeedHelperOptions } from './seeds';
import { upsertEmbeddingForItem } from './embeddings';

type CreateInsightInput = {
  seedId?: string | null;
  summary: string;
  details?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  confidence?: number | null;
};

export const createInsight = async (
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  input: CreateInsightInput,
  options?: SeedHelperOptions,
): Promise<Insight> => {
  await ensureWorkspaceMembership(supabase, workspaceId, userId, options);

  const payload = {
    workspace_id: workspaceId,
    seed_id: input.seedId ?? null,
    created_by: userId,
    source_type: input.sourceType ?? 'copilot',
    source_id: input.sourceId ?? null,
    summary: input.summary,
    details: input.details ?? null,
    confidence: input.confidence ?? null,
  };

  const { data, error } = await supabase
    .from('insights')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to create insight');
  }

  await supabase.from('events').insert({
    workspace_id: workspaceId,
    user_id: userId,
    seed_id: input.seedId ?? null,
    type: 'insight_created',
    payload: { seed_id: input.seedId ?? null, insight_id: data.id },
  });

  try {
    await upsertEmbeddingForItem(supabase, {
      workspaceId,
      seedId: input.seedId ?? null,
      itemType: 'insight',
      itemId: data.id,
      text: `${data.summary}\n${data.details ?? ''}`,
      metadata: { source_type: data.source_type },
    });
  } catch (embeddingError) {
    console.warn('[insights] embedding upsert failed', embeddingError);
  }

  return data as Insight;
};

export const getInsightsForSeed = async (
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  seedId: string,
  options?: SeedHelperOptions,
): Promise<Insight[]> => {
  await ensureWorkspaceMembership(supabase, workspaceId, userId, options);
  const { data, error } = await supabase
    .from('insights')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('seed_id', seedId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as Insight[];
};
