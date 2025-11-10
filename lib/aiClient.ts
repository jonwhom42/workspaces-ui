import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;

if (!apiKey) {
  console.warn('[aiClient] Missing OPENAI_API_KEY/AIP_API_KEY. Copilot features will fail without it.');
}

const openai = apiKey
  ? new OpenAI({
      apiKey,
    })
  : null;

const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const chatModel = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';

export type CopilotMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type CopilotLens = 'explore' | 'distill' | 'design' | 'mirror';

export type CopilotStructuredMode =
  | 'generic_answer'
  | 'seed_proposal'
  | 'insight'
  | 'experiment_suggestion'
  | 'principle_suggestion';

type SeedProposal = {
  title: string;
  summary?: string;
  why_it_matters?: string;
};

type InsightSuggestion = {
  summary: string;
  details?: string;
  confidence?: number;
};

type ExperimentSuggestion = {
  title: string;
  hypothesis?: string;
  plan?: string;
};

type PrincipleSuggestion = {
  statement: string;
  category?: string;
};

export type CopilotStructuredSuggestion =
  | {
      mode: 'generic_answer';
      content: string;
      structured?: undefined;
    }
  | {
      mode: 'seed_proposal';
      content: string;
      structured: SeedProposal;
    }
  | {
      mode: 'insight';
      content: string;
      structured: InsightSuggestion;
    }
  | {
      mode: 'experiment_suggestion';
      content: string;
      structured: ExperimentSuggestion;
    }
  | {
      mode: 'principle_suggestion';
      content: string;
      structured: PrincipleSuggestion;
    };

type CopilotContext = {
  type: string;
  title?: string | null;
  snippet: string;
  ref: string;
};

type GenerateCopilotAnswerParams = {
  mode: 'ask' | 'summarize' | 'reflect' | 'plan';
  lens: CopilotLens;
  workspaceSummary?: string;
  seedSummary?: string;
  principles?: string[];
  contexts: CopilotContext[];
  messages: CopilotMessage[];
};

const lensGuidance: Record<CopilotLens, string> = {
  explore:
    'Explore broadly. Combine knowledge, insights, experiments, and principles to answer with curiosity.',
  distill:
    'Distill durable truths. Favor concise takeaways grounded in proven knowledge and principles.',
  design:
    'Design concrete experiments or plans. Emphasize clear next steps, hypotheses, and observable outcomes.',
  mirror:
    'Reflect the workspace back to the team. Ask thoughtful questions, highlight principles, and surface alignment gaps.',
};

const buildSystemPrompt = ({
  mode,
  lens,
  workspaceSummary,
  seedSummary,
  principles,
  contexts,
}: GenerateCopilotAnswerParams) => {
  const lines: string[] = [];
  lines.push(
    [
      'You are the Observers workspace copilot. Always ground answers in workspace context and admit when information is missing.',
      `Mode: ${mode}.`,
      `Lens: ${lens}. ${lensGuidance[lens]}`,
    ].join(' '),
  );
  if (workspaceSummary) {
    lines.push(`Workspace summary:\n${workspaceSummary}`);
  }
  if (seedSummary) {
    lines.push(`Seed summary:\n${seedSummary}`);
  }
  if (principles?.length) {
    lines.push(`Principles:\n${principles.map((principle, index) => `${index + 1}. ${principle}`).join('\n')}`);
  }
  if (contexts.length) {
    lines.push(
      `Context snippets:\n${contexts
        .map(
          (ctx, idx) =>
            `[${idx + 1}] (${ctx.type}${ctx.title ? ` - ${ctx.title}` : ''}) ${ctx.snippet}\nSource: ${ctx.ref}`,
        )
        .join('\n')}`,
    );
  } else {
    lines.push('No supporting context was provided.');
  }
  lines.push(
    [
      'Instructions: Provide an actionable answer backed by the context above.',
      'Return both a natural-language response and, when appropriate, populate the structured JSON fields.',
      'If the context is insufficient, reply with "I am not sure" and propose concrete next steps.',
      'Do not hallucinate citations.',
    ].join(' '),
  );
  return lines.join('\n\n');
};

const structuredResponseSchema = {
  name: 'copilot_response',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['answer', 'mode'],
    properties: {
      answer: {
        type: 'string',
        description: 'Natural-language response for the user.',
      },
      mode: {
        type: 'string',
        enum: [
          'generic_answer',
          'seed_proposal',
          'insight',
          'experiment_suggestion',
          'principle_suggestion',
        ],
      },
      structured: {
        type: 'object',
        additionalProperties: true,
        description: 'Optional structured payload aligned with the mode.',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          why_it_matters: { type: 'string' },
          hypothesis: { type: 'string' },
          plan: { type: 'string' },
          details: { type: 'string' },
          confidence: { type: 'number' },
          statement: { type: 'string' },
          category: { type: 'string' },
        },
      },
    },
  },
} as const;

const coerceSeedProposal = (candidate: any): SeedProposal | null => {
  if (!candidate) return null;
  const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
  const summary = typeof candidate.summary === 'string' ? candidate.summary.trim() : undefined;
  const why = typeof candidate.why_it_matters === 'string' ? candidate.why_it_matters.trim() : undefined;
  if (!title && !summary && !why) {
    return null;
  }
  return {
    title: title || 'New Seed',
    summary,
    why_it_matters: why,
  };
};

const coerceInsight = (candidate: any): InsightSuggestion | null => {
  if (!candidate) return null;
  const summary = typeof candidate.summary === 'string' ? candidate.summary.trim() : '';
  if (!summary) return null;
  return {
    summary,
    details: typeof candidate.details === 'string' ? candidate.details.trim() : undefined,
    confidence:
      typeof candidate.confidence === 'number'
        ? Math.max(-100, Math.min(100, candidate.confidence))
        : undefined,
  };
};

const coerceExperiment = (candidate: any): ExperimentSuggestion | null => {
  if (!candidate) return null;
  const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
  const plan = typeof candidate.plan === 'string' ? candidate.plan.trim() : undefined;
  const hypothesis = typeof candidate.hypothesis === 'string' ? candidate.hypothesis.trim() : undefined;
  if (!title && !plan && !hypothesis) {
    return null;
  }
  return {
    title: title || 'Experiment idea',
    plan,
    hypothesis,
  };
};

const coercePrinciple = (candidate: any): PrincipleSuggestion | null => {
  if (!candidate) return null;
  const statement = typeof candidate.statement === 'string' ? candidate.statement.trim() : '';
  if (!statement) return null;
  return {
    statement,
    category: typeof candidate.category === 'string' ? candidate.category.trim() : undefined,
  };
};

const parseJsonFromModel = (content: string): any => {
  try {
    return JSON.parse(content);
  } catch (_) {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Unable to parse model response as JSON');
  }
};

export const getEmbeddingForText = async (text: string): Promise<number[]> => {
  if (!openai) {
    throw new Error('AI client is not configured');
  }
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Cannot embed empty text');
  }
  const response = await openai.embeddings.create({
    model: embeddingModel,
    input: trimmed,
  });
  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error('Embedding response missing data');
  }
  return embedding;
};

export const generateCopilotAnswer = async ({
  messages,
  lens,
  ...rest
}: GenerateCopilotAnswerParams): Promise<{
  answer: string;
  structured: CopilotStructuredSuggestion;
}> => {
  if (!openai) {
    throw new Error('AI client is not configured');
  }
  const systemPrompt = buildSystemPrompt({ messages, lens, ...rest });
  const completionMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  const response = await openai.chat.completions.create({
    model: chatModel,
    temperature: 0.3,
    messages: completionMessages,
    response_format: {
      type: 'json_schema',
      json_schema: structuredResponseSchema,
    },
  });

  const rawContent = response.choices[0]?.message?.content?.trim();
  if (!rawContent) {
    throw new Error('Copilot response missing content');
  }

  const parsed = parseJsonFromModel(rawContent);
  const responseAnswer = typeof parsed.answer === 'string' ? parsed.answer.trim() : rawContent;
  const mode: CopilotStructuredMode = [
    'generic_answer',
    'seed_proposal',
    'insight',
    'experiment_suggestion',
    'principle_suggestion',
  ].includes(parsed.mode)
    ? parsed.mode
    : 'generic_answer';

  let structuredPayload: CopilotStructuredSuggestion | undefined;
  if (mode === 'seed_proposal') {
    const seedDraft = coerceSeedProposal(parsed.structured);
    if (seedDraft) {
      structuredPayload = { mode, content: responseAnswer, structured: seedDraft };
    }
  } else if (mode === 'insight') {
    const insight = coerceInsight(parsed.structured);
    if (insight) {
      structuredPayload = { mode, content: responseAnswer, structured: insight };
    }
  } else if (mode === 'experiment_suggestion') {
    const experiment = coerceExperiment(parsed.structured);
    if (experiment) {
      structuredPayload = { mode, content: responseAnswer, structured: experiment };
    }
  } else if (mode === 'principle_suggestion') {
    const principle = coercePrinciple(parsed.structured);
    if (principle) {
      structuredPayload = { mode, content: responseAnswer, structured: principle };
    }
  }

  if (!structuredPayload) {
    structuredPayload = { mode: 'generic_answer', content: responseAnswer };
  }

  return { answer: responseAnswer, structured: structuredPayload };
};

export const moderateText = async (text: string): Promise<{ flagged: boolean }> => {
  if (!openai) {
    throw new Error('AI client is not configured');
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return { flagged: false };
  }
  const response = await openai.moderations.create({
    model: 'omni-moderation-latest',
    input: trimmed,
  });
  const flagged = response.results?.some((result) => result.flagged) ?? false;
  return { flagged };
};

export type SeedDraft = {
  title: string;
  summary: string;
  why_it_matters: string;
  suggested_tags: string[];
};

export const draftSeedFromIdea = async (idea: string): Promise<SeedDraft> => {
  if (!openai) {
    throw new Error('AI client is not configured');
  }
  const trimmed = idea.trim();
  if (!trimmed) {
    throw new Error('Idea text is required');
  }

  const response = await openai.chat.completions.create({
    model: chatModel,
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content:
          'You help product teams structure early ideas into Seeds. Respond with valid JSON only and never include commentary.',
      },
      {
        role: 'user',
        content: `Draft a seed proposal from this idea:\n${trimmed}\n\nReturn JSON with keys: title (string), summary (string), why_it_matters (string), suggested_tags (string array of up to 3 entries).`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No draft returned');
  }

  const parsed = parseJsonFromModel(content);

  const draft: SeedDraft = {
    title: String(parsed.title ?? '').trim(),
    summary: String(parsed.summary ?? '').trim(),
    why_it_matters: String(parsed.why_it_matters ?? '').trim(),
    suggested_tags: Array.isArray(parsed.suggested_tags)
      ? parsed.suggested_tags.map((tag: unknown) => String(tag).trim()).filter(Boolean).slice(0, 3)
      : [],
  };

  if (!draft.title) {
    draft.title = trimmed.slice(0, 60);
  }
  return draft;
};

export const distillSeedFromConversation = async (
  messages: CopilotMessage[],
): Promise<SeedDraft & { insights: string[] }> => {
  if (!openai) {
    throw new Error('AI client is not configured');
  }
  if (!messages.length) {
    throw new Error('Conversation is required');
  }
  const transcript = messages
    .map((message) => `${message.role === 'user' ? 'User' : 'Copilot'}: ${message.content}`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model: chatModel,
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content:
          'You analyze multi-turn idea conversations and extract structured Seeds. Respond with JSON only.',
      },
      {
        role: 'user',
        content: `Conversation:\n${transcript}\n\nReturn JSON with keys: title, why_it_matters, summary, suggested_tags (array up to 3), insights (array of strings).`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No draft returned');
  }

  const parsed = parseJsonFromModel(content);
  const draft: SeedDraft = {
    title: String(parsed.title ?? '').trim(),
    summary: String(parsed.summary ?? '').trim(),
    why_it_matters: String(parsed.why_it_matters ?? '').trim(),
    suggested_tags: Array.isArray(parsed.suggested_tags)
      ? parsed.suggested_tags.map((tag: unknown) => String(tag).trim()).filter(Boolean).slice(0, 3)
      : [],
  };
  if (!draft.title) {
    draft.title = 'New Seed';
  }

  const insights: string[] = Array.isArray(parsed.insights)
    ? parsed.insights.map((entry: unknown) => String(entry).trim()).filter(Boolean)
    : [];

  return { ...draft, insights };
};
