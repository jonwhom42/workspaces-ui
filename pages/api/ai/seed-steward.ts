import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabase } from '../../../lib/supabaseServer';
import { getUserWorkspaceById } from '../../../lib/workspaces';
import { getSeedStewardSuggestions } from '../../../lib/aiClient';

const truncate = (value: string | null | undefined, length: number) =>
  value ? value.slice(0, length) : '';

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

  const { workspaceId, seedId } = req.body ?? {};

  if (typeof workspaceId !== 'string' || !workspaceId.trim()) {
    return res.status(400).json({ error: 'workspaceId is required' });
  }

  if (typeof seedId !== 'string' || !seedId.trim()) {
    return res.status(400).json({ error: 'seedId is required' });
  }

  const membership = await getUserWorkspaceById(supabase, user.id, workspaceId);
  if (!membership) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { data: seed, error: seedError } = await supabase
    .from('seeds')
    .select('id, workspace_id, title, summary, why_it_matters, status')
    .eq('workspace_id', workspaceId)
    .eq('id', seedId)
    .maybeSingle();

  if (seedError) {
    console.error('[seed-steward] seed fetch failed', seedError);
    return res.status(500).json({ error: 'Unable to load seed' });
  }

  if (!seed) {
    return res.status(404).json({ error: 'Seed not found' });
  }

  try {
    const [
      { data: knowledgeRows, error: knowledgeError },
      { data: insightRows, error: insightError },
      { data: experimentRows, error: experimentError },
      { data: eventRows, error: eventError },
    ] = await Promise.all([
      supabase
        .from('knowledge_items')
        .select('id, title, content, type')
        .eq('workspace_id', workspaceId)
        .eq('seed_id', seedId)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('insights')
        .select('summary, details')
        .eq('workspace_id', workspaceId)
        .eq('seed_id', seedId)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('experiments')
        .select('title, status, hypothesis, plan, result_summary')
        .eq('workspace_id', workspaceId)
        .eq('seed_id', seedId)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('events')
        .select('type, payload, created_at')
        .eq('workspace_id', workspaceId)
        .eq('seed_id', seedId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    if (knowledgeError || insightError || experimentError || eventError) {
      throw knowledgeError || insightError || experimentError || eventError;
    }

    const suggestions = await getSeedStewardSuggestions({
      seed: {
        title: seed.title,
        summary: seed.summary,
        why_it_matters: seed.why_it_matters,
        status: seed.status,
      },
      knowledge:
        knowledgeRows?.map((item) => ({
          title: item.title,
          type: item.type,
          snippet: truncate(item.content ?? item.title ?? '', 220) || 'No content provided.',
        })) ?? [],
      insights:
        insightRows?.map((insight) => ({
          summary: truncate(insight.summary, 260),
          details: truncate(insight.details, 260) || undefined,
        })) ?? [],
      experiments:
        experimentRows?.map((experiment) => ({
          title: experiment.title,
          status: experiment.status,
          hypothesis: truncate(experiment.hypothesis, 200) || undefined,
          plan: truncate(experiment.plan, 200) || undefined,
          result_summary: truncate(experiment.result_summary, 200) || undefined,
        })) ?? [],
      events:
        eventRows?.map((event) => ({
          type: event.type,
          created_at: event.created_at,
          note:
            typeof event.payload === 'object'
              ? JSON.stringify(event.payload).slice(0, 200)
              : null,
        })) ?? [],
    });

    await supabase.from('events').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      seed_id: seedId,
      type: 'seed_steward_requested',
      payload: {
        suggestion_counts: {
          summary: Number(Boolean(suggestions.summary_update)),
          insights: suggestions.insight_suggestions?.length ?? 0,
          experiments: suggestions.experiment_suggestions?.length ?? 0,
          principles: suggestions.principle_suggestions?.length ?? 0,
        },
      },
    });

    return res.status(200).json({ suggestions });
  } catch (error) {
    console.error('[api/ai/seed-steward] failed', error);
    return res.status(500).json({ error: 'Unable to generate steward suggestions' });
  }
}
