import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabase } from '../../../lib/supabaseServer';
import { getUserWorkspaceById } from '../../../lib/workspaces';
import {
  type CopilotLens,
  type CopilotMessage,
  generateCopilotAnswer,
  getEmbeddingForText,
  moderateText,
} from '../../../lib/aiClient';
import { getRelevantContextsForQuery } from '../../../lib/embeddings';

const allowedModes = new Set(['ask', 'summarize', 'reflect', 'plan']);
const allowedLenses = new Set(['explore', 'distill', 'design', 'mirror']);

const lensContextPriority: Record<CopilotLens, string[]> = {
  explore: ['knowledge', 'insight', 'experiment', 'principle'],
  distill: ['insight', 'principle', 'knowledge', 'experiment'],
  design: ['experiment', 'knowledge', 'insight', 'principle'],
  mirror: ['principle', 'insight', 'knowledge', 'experiment'],
};

const prioritizeContexts = <T extends { type: string }>(contexts: T[], lens: CopilotLens): T[] => {
  const order = lensContextPriority[lens] ?? [];
  const fallbackIndex = order.length + 1;
  return [...contexts].sort((a, b) => {
    const aIndex = order.indexOf(a.type);
    const bIndex = order.indexOf(b.type);
    return (aIndex === -1 ? fallbackIndex : aIndex) - (bIndex === -1 ? fallbackIndex : bIndex);
  });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createServerSupabase({ req, res });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { workspaceId, seedId, mode = 'ask', lens = 'explore', messages } = req.body ?? {};

  if (typeof workspaceId !== 'string' || !workspaceId) {
    return res.status(400).json({ error: 'workspaceId is required' });
  }

  if (seedId && typeof seedId !== 'string') {
    return res.status(400).json({ error: 'seedId must be a string' });
  }

  if (!allowedModes.has(mode)) {
    return res.status(400).json({ error: 'Invalid mode' });
  }

  if (typeof lens !== 'string' || !allowedLenses.has(lens)) {
    return res.status(400).json({ error: 'Invalid lens' });
  }

  const normalizedLens = lens as CopilotLens;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }

  const normalizedMessages: CopilotMessage[] = messages
    .map((message) => ({
      role: message?.role,
      content: typeof message?.content === 'string' ? message.content : '',
    }))
    .filter(
      (message) => message.role === 'user' || message.role === 'assistant',
    ) as CopilotMessage[];

  if (!normalizedMessages.length) {
    return res.status(400).json({ error: 'At least one user message is required' });
  }

  const lastUserMessage = [...normalizedMessages]
    .reverse()
    .find((message) => message.role === 'user' && message.content.trim().length);

  if (!lastUserMessage) {
    return res.status(400).json({ error: 'Must include a user message' });
  }

  const membership = await getUserWorkspaceById(supabase, user.id, workspaceId);
  if (!membership) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const moderation = await moderateText(lastUserMessage.content);
  if (moderation.flagged) {
    return res.status(400).json({ error: 'Message failed moderation' });
  }

  let queryEmbedding: number[];
  try {
    queryEmbedding = await getEmbeddingForText(lastUserMessage.content);
  } catch (error) {
    console.error('[api/ai/query] Embedding error', error);
    return res.status(500).json({ error: 'Embedding generation failed' });
  }

  const { contexts } = await getRelevantContextsForQuery(supabase, {
    workspaceId,
    seedId: seedId ?? null,
    queryEmbedding,
    limit: 10,
  });
  const prioritizedContexts = prioritizeContexts(contexts, normalizedLens);

  const principles: string[] = [];
  const { data: workspacePrinciples } = await supabase
    .from('principles')
    .select('statement, category')
    .eq('workspace_id', workspaceId)
    .eq('active', true)
    .is('seed_id', null);
  workspacePrinciples?.forEach((principle) =>
    principles.push(
      `${principle.statement}${principle.category ? ` (${principle.category})` : ''}`,
    ),
  );
  if (seedId) {
    const { data: seedPrinciples } = await supabase
      .from('principles')
      .select('statement, category')
      .eq('workspace_id', workspaceId)
      .eq('active', true)
      .eq('seed_id', seedId);
    seedPrinciples?.forEach((principle) =>
      principles.push(
        `${principle.statement}${principle.category ? ` (${principle.category})` : ''}`,
      ),
    );
  }

  const { data: seedRow } = seedId
    ? await supabase
        .from('seeds')
        .select('title, summary, why_it_matters')
        .eq('workspace_id', workspaceId)
        .eq('id', seedId)
        .maybeSingle()
    : { data: null };

  let workspaceSummary: string | undefined;
  const { count: seedCount } = await supabase
    .from('seeds')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);
  if (typeof seedCount === 'number') {
    workspaceSummary = `Workspace contains ${seedCount} seeds.`;
  }

  try {
    const copilotResponse = await generateCopilotAnswer({
      messages: normalizedMessages,
      mode,
      lens: normalizedLens,
      workspaceSummary,
      seedSummary: seedRow
        ? `${seedRow.title ?? ''}\n${seedRow.summary ?? ''}\n${seedRow.why_it_matters ?? ''}`
        : undefined,
      principles,
      contexts: prioritizedContexts,
    });

    await supabase.from('events').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      seed_id: seedId ?? null,
      type: 'copilot_query',
      payload: {
        mode,
        lens: normalizedLens,
        context_refs: prioritizedContexts.slice(0, 5).map((ctx) => ctx.ref),
      },
    });

    return res.status(200).json({
      message: { role: 'assistant', content: copilotResponse.answer },
      structured: copilotResponse.structured,
      sources: prioritizedContexts.map((ctx) => ({
        type: ctx.type,
        ref: ctx.ref,
        label: ctx.title ?? ctx.ref,
      })),
    });
  } catch (error) {
    console.error('[api/ai/query] failed', error);
    return res.status(500).json({ error: 'Copilot failed to answer' });
  }
}
