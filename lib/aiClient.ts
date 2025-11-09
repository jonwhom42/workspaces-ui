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

type CopilotContext = {
  type: string;
  title?: string;
  snippet: string;
  ref: string;
};

type GenerateCopilotAnswerParams = {
  query: string;
  mode: 'ask' | 'summarize' | 'reflect' | 'plan';
  workspaceSummary?: string;
  seedSummary?: string;
  principles?: string[];
  contexts: CopilotContext[];
};

const buildUserPrompt = ({
  query,
  mode,
  workspaceSummary,
  seedSummary,
  principles,
  contexts,
}: GenerateCopilotAnswerParams) => {
  const lines: string[] = [];
  if (workspaceSummary) {
    lines.push(`Workspace summary:\n${workspaceSummary}`);
  }
  if (seedSummary) {
    lines.push(`Seed summary:\n${seedSummary}`);
  }
  if (principles?.length) {
    lines.push('Principles:');
    principles.forEach((p, idx) => lines.push(`${idx + 1}. ${p}`));
  }
  if (contexts.length) {
    lines.push('Context snippets:');
    contexts.forEach((ctx, idx) => {
      lines.push(
        `[${idx + 1}] (${ctx.type}${ctx.title ? ` · ${ctx.title}` : ''}) ${ctx.snippet}\nSource: ${ctx.ref}`,
      );
    });
  }
  lines.push(`Mode: ${mode}`);
  lines.push(`User query: ${query}`);
  lines.push('Provide an actionable answer grounded in the snippets. If the context is insufficient, say "I\'m not sure."');
  return lines.join('\n\n');
};

export const generateCopilotAnswer = async (
  params: GenerateCopilotAnswerParams,
): Promise<{ answer: string; reasoning?: string }> => {
  if (!openai) {
    throw new Error('AI client is not configured');
  }
  const systemPrompt = `You are the Observers' workspace copilot. Always ground answers in the provided context. 
If the context does not contain the information needed, respond with "I'm not sure" and recommend next steps. 
Be concise, structured, and actionable.`;

  const userPrompt = buildUserPrompt(params);

  const response = await openai.chat.completions.create({
    model: chatModel,
    temperature: 0.3,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const answer = response.choices[0]?.message?.content?.trim();
  if (!answer) {
    throw new Error('Copilot response missing content');
  }

  return { answer };
};

export const moderateText = async (text: string): Promise<{ flagged: boolean }> => {
  if (!openai) {
    return { flagged: false };
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
