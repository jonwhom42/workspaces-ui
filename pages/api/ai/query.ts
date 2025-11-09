import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabase } from '../../../lib/supabaseServer';
import { getUserWorkspaceById } from '../../../lib/workspaces';
import { getEmbeddingForText, generateCopilotAnswer, moderateText } from '../../../lib/aiClient';
import { getRelevantContextsForQuery } from '../../../lib/embeddings';

const allowedModes = new Set(['ask', 'summarize', 'reflect', 'plan']);

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

  const { workspaceId, seedId, mode = 'ask', message } = req.body ?? {};

  if (typeof workspaceId !== 'string' || !workspaceId) {
    return res.status(400).json({ error: 'workspaceId is required' });
  }

  if (seedId && typeof seedId !== 'string') {
    return res.status(400).json({ error: 'seedId must be a string' });
  }

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  if (!allowedModes.has(mode)) {
    return res.status(400).json({ error: 'Invalid mode' });
  }

  const membership = await getUserWorkspaceById(supabase, user.id, workspaceId);
  if (!membership) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const moderation = await moderateText(message);
  if (moderation.flagged) {
    return res.status(400).json({ error: 'Message failed moderation' });
  }

  let queryEmbedding: number[];
  try {
    queryEmbedding = await getEmbeddingForText(message);
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

  const principles: string[] = [];
  const { data: workspacePrinciples } = await supabase
    .from('principles')
    .select('statement, category, seed_id')
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
    const answer = await generateCopilotAnswer({
      query: message,
      mode,
      workspaceSummary,
      seedSummary: seedRow
        ? `${seedRow.title ?? ''}\n${seedRow.summary ?? ''}\n${seedRow.why_it_matters ?? ''}`
        : undefined,
      principles,
      contexts,
    });

    await supabase.from('events').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      seed_id: seedId ?? null,
      type: 'copilot_query',
      payload: {
        mode,
        context_refs: contexts.slice(0, 5).map((ctx) => ctx.ref),
      },
    });

    return res.status(200).json({
      answer: answer.answer,
      sources: contexts.map((ctx) => ({
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
