import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabase } from '../../../lib/supabaseServer';
import { getUserWorkspaceById } from '../../../lib/workspaces';
import {
  distillSeedFromConversation,
  type CopilotMessage,
} from '../../../lib/aiClient';
import { createSeed } from '../../../lib/seeds';
import { createKnowledgeItem } from '../../../lib/knowledge';
import { createInsight } from '../../../lib/insights';

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

  const { workspaceId, messages, seedDraft } = req.body ?? {};

  if (typeof workspaceId !== 'string' || !workspaceId) {
    return res.status(400).json({ error: 'workspaceId is required' });
  }

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
    return res.status(400).json({ error: 'Conversation must include user messages' });
  }

  const membership = await getUserWorkspaceById(supabase, user.id, workspaceId);
  if (!membership) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const aiDraft = await distillSeedFromConversation(normalizedMessages);
    const override =
      seedDraft && typeof seedDraft === 'object'
        ? {
            title:
              typeof seedDraft.title === 'string' ? seedDraft.title.trim() : undefined,
            summary:
              typeof seedDraft.summary === 'string' ? seedDraft.summary.trim() : undefined,
            why_it_matters:
              typeof seedDraft.why_it_matters === 'string'
                ? seedDraft.why_it_matters.trim()
                : undefined,
          }
        : null;

    const mergedDraft = {
      ...aiDraft,
      title: override?.title || aiDraft.title || 'New Seed',
      summary: override?.summary ?? aiDraft.summary,
      why_it_matters: override?.why_it_matters ?? aiDraft.why_it_matters,
    };

    const seed = await createSeed(
      supabase,
      workspaceId,
      user.id,
      {
        title: mergedDraft.title,
        summary: mergedDraft.summary,
        whyItMatters: mergedDraft.why_it_matters,
      },
      {},
    );

    const transcript = normalizedMessages
      .map((message) => `${message.role === 'user' ? 'User' : 'Copilot'}: ${message.content}`)
      .join('\n');

    await createKnowledgeItem(
      supabase,
      workspaceId,
      user.id,
      {
        seedId: seed.id,
        type: 'transcript',
        title: 'Conversation transcript',
        content: transcript,
      },
      {},
    );

    if (mergedDraft.suggested_tags.length) {
      await supabase
        .from('events')
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          seed_id: seed.id,
          type: 'seed_tags_suggested',
          payload: { tags: mergedDraft.suggested_tags },
        })
        .select('id');
    }

    if (mergedDraft.insights?.length) {
      await Promise.all(
        mergedDraft.insights.slice(0, 5).map((insight) =>
          createInsight(
            supabase,
            workspaceId,
            user.id,
            {
              seedId: seed.id,
              summary: insight.summary,
              details: insight.details ?? null,
              sourceType: 'copilot',
            },
            {},
          ),
        ),
      );
    }

    await supabase.from('events').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      seed_id: seed.id,
      type: 'seed_created_from_conversation',
      payload: {
        message_count: normalizedMessages.length,
        insight_count: mergedDraft.insights.length,
      },
    });

    return res.status(200).json({ seedId: seed.id });
  } catch (error) {
    console.error('[api/seeds/from-conversation] failed', error);
    return res.status(500).json({ error: 'Unable to distill conversation into seed' });
  }
}
