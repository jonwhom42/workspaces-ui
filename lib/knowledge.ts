import type { SupabaseClient } from '@supabase/supabase-js';
import type { KnowledgeItem } from '../types/db';
import { getUserWorkspaceById } from './workspaces';
import type { SeedHelperOptions } from './seeds';
import { upsertEmbeddingForItem } from './embeddings';

const ensureWorkspaceMembership = async (
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

export const getKnowledgeForSeed = async (
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  seedId: string,
  options?: SeedHelperOptions,
): Promise<KnowledgeItem[]> => {
  await ensureWorkspaceMembership(supabase, workspaceId, userId, options);
  const { data, error } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('seed_id', seedId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data as KnowledgeItem[];
};

type CreateKnowledgeInput = {
  seedId: string;
  type: string;
  title?: string;
  content?: string;
  sourceUrl?: string;
};

export const createKnowledgeItem = async (
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  input: CreateKnowledgeInput,
  options?: SeedHelperOptions,
): Promise<KnowledgeItem> => {
  await ensureWorkspaceMembership(supabase, workspaceId, userId, options);
  const payload = {
    workspace_id: workspaceId,
    seed_id: input.seedId,
    created_by: userId,
    type: input.type,
    title: input.title ?? null,
    content: input.content ?? null,
    source_url: input.sourceUrl ?? null,
  };

  const { data, error } = await supabase
    .from('knowledge_items')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Unable to create knowledge item');
  }

  await supabase.from('events').insert({
    workspace_id: workspaceId,
    user_id: userId,
    seed_id: input.seedId,
    type: 'knowledge_created',
    payload: { seed_id: input.seedId, knowledge_id: data.id, item_type: input.type },
  });

  try {
    await upsertEmbeddingForItem(supabase, {
      workspaceId,
      seedId: input.seedId,
      itemType: 'knowledge',
      itemId: data.id,
      text: [data.title, data.content, data.source_url].filter(Boolean).join('\n'),
      metadata: {
        type: data.type,
        title: data.title,
      },
    });
  } catch (embeddingError) {
    console.warn('[knowledge] embedding upsert failed', embeddingError);
  }

  return data as KnowledgeItem;
};
