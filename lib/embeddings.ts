import type { SupabaseClient } from '@supabase/supabase-js';
import { getEmbeddingForText } from './aiClient';

type UpsertEmbeddingParams = {
  workspaceId: string;
  seedId?: string | null;
  itemType: 'knowledge' | 'experiment' | 'principle' | 'insight';
  itemId: string;
  text: string | null | undefined;
  metadata?: Record<string, unknown>;
};

const MIN_TEXT_LENGTH = 24;

export const upsertEmbeddingForItem = async (
  supabase: SupabaseClient,
  params: UpsertEmbeddingParams,
) => {
  const cleaned = params.text?.trim();
  if (!cleaned || cleaned.length < MIN_TEXT_LENGTH) {
    return;
  }
  const embedding = await getEmbeddingForText(cleaned);
  const { error } = await supabase
    .from('embeddings')
    .upsert(
      {
        workspace_id: params.workspaceId,
        seed_id: params.seedId ?? null,
        item_type: params.itemType,
        item_id: params.itemId,
        embedding,
        metadata: params.metadata ?? null,
      },
      { onConflict: 'workspace_id,item_id' },
    );

  if (error) {
    throw error;
  }
};

type ContextResult = {
  type: string;
  title?: string | null;
  snippet: string;
  ref: string;
};

type RelevantContextParams = {
  workspaceId: string;
  seedId?: string | null;
  queryEmbedding: number[];
  limit?: number;
};

export const getRelevantContextsForQuery = async (
  supabase: SupabaseClient,
  { workspaceId, seedId = null, queryEmbedding, limit = 10 }: RelevantContextParams,
): Promise<{ contexts: ContextResult[] }> => {
  const { data, error } = await supabase.rpc('match_workspace_embeddings', {
    p_workspace_id: workspaceId,
    p_seed_id: seedId,
    p_query_embedding: queryEmbedding,
    p_match_count: limit,
  });

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return { contexts: [] };
  }

  const grouped: Record<string, string[]> = {};
  data.forEach((row: any) => {
    if (!grouped[row.item_type]) {
      grouped[row.item_type] = [];
    }
    grouped[row.item_type].push(row.item_id);
  });

  const fetchByType = async (
    itemType: string,
    ids: string[],
  ): Promise<Record<string, { title?: string | null; snippet: string; ref: string }>> => {
    if (!ids.length) {
      return {};
    }
    const tableMap: Record<string, string> = {
      knowledge: 'knowledge_items',
      experiment: 'experiments',
      principle: 'principles',
      insight: 'insights',
    };
    const table = tableMap[itemType];
    if (!table) {
      return {};
    }
    const { data: rows, error: fetchError } = await supabase
      .from(table)
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('id', ids);
    if (fetchError || !rows) {
      return {};
    }
    const map: Record<string, { title?: string | null; snippet: string; ref: string }> = {};
    rows.forEach((row: any) => {
      let snippetSource = row.content || row.summary || row.statement || row.details || '';
      if (row.source_url && !snippetSource) {
        snippetSource = `Source: ${row.source_url}`;
      }
      const snippet =
        snippetSource?.toString().trim().slice(0, 320) ||
        'Summary unavailable for this item.';
      map[row.id] = {
        title: row.title ?? row.statement ?? row.summary ?? null,
        snippet,
        ref: `${table}:${row.id}`,
      };
    });
    return map;
  };

  const knowledgeMap = await fetchByType('knowledge', grouped.knowledge ?? []);
  const experimentMap = await fetchByType('experiment', grouped.experiment ?? []);
  const principleMap = await fetchByType('principle', grouped.principle ?? []);
  const insightMap = await fetchByType('insight', grouped.insight ?? []);

  const contexts: ContextResult[] = [];

  data.forEach((row: any) => {
    let entry:
      | { title?: string | null; snippet: string; ref: string }
      | undefined;
    switch (row.item_type) {
      case 'knowledge':
        entry = knowledgeMap[row.item_id];
        break;
      case 'experiment':
        entry = experimentMap[row.item_id];
        break;
      case 'principle':
        entry = principleMap[row.item_id];
        break;
      case 'insight':
        entry = insightMap[row.item_id];
        break;
      default:
        break;
    }
    if (entry) {
      contexts.push({
        type: row.item_type,
        title: entry.title ?? row.metadata?.title ?? null,
        snippet: entry.snippet,
        ref: entry.ref,
      });
    }
  });

  return { contexts };
};
