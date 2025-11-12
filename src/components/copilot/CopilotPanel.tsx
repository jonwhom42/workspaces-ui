import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { CopilotLens, CopilotMessage, CopilotStructured } from '../../../lib/aiClient';

type Mode = 'ask' | 'summarize' | 'reflect' | 'plan';
type Lens = CopilotLens;

type Source = {
  type: string;
  ref: string;
  label: string;
};

type CopilotResponsePayload = {
  message: CopilotMessage;
  sources?: Source[];
  structured?: CopilotStructured;
  error?: string;
};

type CopilotPanelProps = {
  workspaceId: string;
  seedId?: string;
  lensDefault?: Lens;
  modeDefault?: Mode;
  allowSeedCreation?: boolean;
  onSeedCreated?: (seedId: string) => void;
};

const MAX_INSIGHT_SUMMARY = 200;

const MODE_OPTIONS: Mode[] = ['ask', 'summarize', 'plan', 'reflect'];
const LENS_OPTIONS: Lens[] = ['explore', 'distill', 'design', 'mirror'];

export function CopilotPanel({
  workspaceId,
  seedId,
  lensDefault = 'explore',
  modeDefault = 'ask',
  allowSeedCreation = false,
  onSeedCreated,
}: CopilotPanelProps) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<CopilotMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [mode, setMode] = React.useState<Mode>(modeDefault);
  const [lens, setLens] = React.useState<Lens>(lensDefault);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sources, setSources] = React.useState<Source[]>([]);
  const [structured, setStructured] = React.useState<CopilotStructured | null>(null);
  const [actionStatus, setActionStatus] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const lastAssistantMessage = React.useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant'),
    [messages],
  );

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    const newMessages = [...messages, { role: 'user', content: trimmed } as CopilotMessage];
    setMessages(newMessages);
    setInput('');
    setError(null);
    setSources([]);
    setStructured(null);
    setActionStatus(null);
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, seedId, mode, lens, messages: newMessages }),
      });
      const payload: CopilotResponsePayload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Copilot request failed');
      }
      setMessages([...newMessages, payload.message]);
      setSources(payload.sources ?? []);
      setStructured(payload.structured ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unexpected error');
    } finally {
      setIsLoading(false);
    }
  };

  const seedDraft = structured?.mode === 'seed_proposal' ? structured.structured : null;
  const experimentDraft =
    structured?.mode === 'experiment_suggestion' ? structured.structured : null;
  const principleDraft =
    structured?.mode === 'principle_suggestion' ? structured.structured : null;

  const refreshSeedPage = React.useCallback(async () => {
    if (seedId) {
      await router.replace(router.asPath);
    }
  }, [router, seedId]);

  const buildInsightFields = () => {
    if (!seedId || !lastAssistantMessage) return null;
    if (structured?.mode === 'insight' && structured.structured) {
      return {
        summary:
          structured.structured.summary ||
          lastAssistantMessage.content.trim().slice(0, MAX_INSIGHT_SUMMARY) ||
          'Insight',
        details: structured.structured.details ?? lastAssistantMessage.content,
        confidence:
          typeof structured.structured.confidence === 'number'
            ? structured.structured.confidence
            : null,
      };
    }
    return {
      summary: lastAssistantMessage.content.trim().slice(0, MAX_INSIGHT_SUMMARY) || 'Insight',
      details: lastAssistantMessage.content,
      confidence: null,
    };
  };

  const handleCreateSeedFromSuggestion = async () => {
    if (!allowSeedCreation || seedId) return;
    if (!seedDraft && !lastAssistantMessage) return;
    setActionLoading(true);
    setError(null);
    setActionStatus(null);
    try {
      const response = await fetch('/api/seeds/from-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          messages,
          seedDraft: seedDraft
            ? {
                title: seedDraft.title,
                summary: seedDraft.summary ?? '',
                why_it_matters: seedDraft.why_it_matters ?? '',
              }
            : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to create seed');
      }
      setActionStatus('Seed created from conversation');
      onSeedCreated?.(payload.seedId);
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : 'Unable to create seed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveInsight = async () => {
    const fields = buildInsightFields();
    if (!fields) return;
    setActionLoading(true);
    setError(null);
    setActionStatus(null);
    try {
      const response = await fetch('/api/insights/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          seedId,
          summary: fields.summary,
          details: fields.details ?? null,
          confidence: fields.confidence,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to save insight');
      }
      setActionStatus('Insight saved');
      await refreshSeedPage();
    } catch (insightError) {
      setError(insightError instanceof Error ? insightError.message : 'Unable to save insight');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateExperiment = async () => {
    if (!seedId || !experimentDraft) return;
    setActionLoading(true);
    setError(null);
    setActionStatus(null);
    try {
      const response = await fetch('/api/experiments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          seedId,
          title: experimentDraft.title,
          hypothesis: experimentDraft.hypothesis ?? null,
          plan: experimentDraft.plan ?? null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to create experiment');
      }
      setActionStatus('Experiment created');
      await refreshSeedPage();
    } catch (experimentError) {
      setError(
        experimentError instanceof Error ? experimentError.message : 'Unable to create experiment',
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreatePrinciple = async () => {
    if (!seedId || !principleDraft) return;
    setActionLoading(true);
    setError(null);
    setActionStatus(null);
    try {
      const response = await fetch('/api/principles/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          seedId,
          statement: principleDraft.statement,
          category: principleDraft.category ?? null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to add principle');
      }
      setActionStatus('Principle added');
      await refreshSeedPage();
    } catch (principleError) {
      setError(
        principleError instanceof Error ? principleError.message : 'Unable to add principle',
      );
    } finally {
      setActionLoading(false);
    }
  };

  const actionButtons: Array<{ label: string; onClick: () => void; variant?: 'outlined' | 'contained' }> = [];
  if (!seedId && allowSeedCreation && (seedDraft || lastAssistantMessage)) {
    actionButtons.push({ label: 'Create seed from this', onClick: handleCreateSeedFromSuggestion });
  }
  if (seedId && lastAssistantMessage) {
    actionButtons.push({ label: 'Save as Insight', onClick: handleSaveInsight, variant: 'outlined' });
  }
  if (seedId && experimentDraft) {
    actionButtons.push({ label: 'Create Experiment', onClick: handleCreateExperiment });
  }
  if (seedId && principleDraft) {
    actionButtons.push({ label: 'Add Principle', onClick: handleCreatePrinciple });
  }

  return (
    <Card variant="outlined">
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack
          ref={scrollRef}
          spacing={1}
          sx={{
            maxHeight: 360,
            overflowY: 'auto',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
            backgroundColor: 'background.default',
          }}
        >
          {messages.length === 0 ? (
            <Typography color="text.secondary">Start the conversation to brief Copilot.</Typography>
          ) : (
            messages.map((message, index) => (
              <Box
                key={`${message.role}-${index}-${message.content.slice(0, 6)}`}
                sx={{
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  bgcolor: message.role === 'user' ? 'primary.main' : 'grey.100',
                  color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                  px: 1.5,
                  py: 1,
                  borderRadius: 2,
                  maxWidth: '80%',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: 14,
                }}
              >
                {message.content}
              </Box>
            ))
          )}
        </Stack>

        <Stack spacing={1}>
          <TextField
            select
            label="Lens"
            size="small"
            sx={{ maxWidth: 220 }}
            value={lens}
            onChange={(event) => setLens(event.target.value as Lens)}
          >
            {LENS_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Mode"
            size="small"
            sx={{ maxWidth: 220 }}
            value={mode}
            onChange={(event) => setMode(event.target.value as Mode)}
          >
            {MODE_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Message"
            multiline
            minRows={3}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask a question or describe what you need..."
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
            <Button variant="contained" onClick={sendMessage} disabled={isLoading || !input.trim()}>
              {isLoading ? 'Thinking...' : 'Send'}
            </Button>
            {actionButtons.length > 0 && (
              <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                {actionButtons.map((action) => (
                  <Button
                    key={action.label}
                    size="small"
                    variant={action.variant ?? 'text'}
                    onClick={action.onClick}
                    disabled={actionLoading}
                  >
                    {action.label}
                  </Button>
                ))}
              </Stack>
            )}
          </Stack>
        </Stack>

        {structured && structured.mode !== 'generic_answer' && structured.structured && (
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
            {structured.mode === 'seed_proposal' && (
              <>
                <Typography variant="subtitle2">Seed proposal</Typography>
                <Typography variant="body2">
                  <strong>Title:</strong> {structured.structured.title}
                </Typography>
                {structured.structured.summary && (
                  <Typography variant="body2">
                    <strong>Summary:</strong> {structured.structured.summary}
                  </Typography>
                )}
                {structured.structured.why_it_matters && (
                  <Typography variant="body2">
                    <strong>Why it matters:</strong> {structured.structured.why_it_matters}
                  </Typography>
                )}
              </>
            )}
            {structured.mode === 'insight' && (
              <>
                <Typography variant="subtitle2">Insight suggestion</Typography>
                <Typography variant="body2">{structured.structured.summary}</Typography>
                {structured.structured.details && (
                  <Typography variant="body2" color="text.secondary">
                    {structured.structured.details}
                  </Typography>
                )}
              </>
            )}
            {structured.mode === 'experiment_suggestion' && (
              <>
                <Typography variant="subtitle2">Experiment suggestion</Typography>
                <Typography variant="body2" fontWeight={600}>
                  {structured.structured.title}
                </Typography>
                {structured.structured.hypothesis && (
                  <Typography variant="body2" color="text.secondary">
                    Hypothesis: {structured.structured.hypothesis}
                  </Typography>
                )}
                {structured.structured.plan && (
                  <Typography variant="body2" color="text.secondary">
                    Plan: {structured.structured.plan}
                  </Typography>
                )}
              </>
            )}
            {structured.mode === 'principle_suggestion' && (
              <>
                <Typography variant="subtitle2">Principle suggestion</Typography>
                <Typography variant="body2">{structured.structured.statement}</Typography>
                {structured.structured.category && (
                  <Typography variant="caption" color="text.secondary">
                    Category: {structured.structured.category}
                  </Typography>
                )}
              </>
            )}
          </Box>
        )}

        {error && (
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        )}
        {actionStatus && (
          <Typography color="success.main" variant="body2">
            {actionStatus}
          </Typography>
        )}
        {sources.length > 0 && (
          <Box>
            <Typography variant="subtitle2">Sources</Typography>
            {sources.map((source) => (
              <Typography key={source.ref} variant="body2" color="text.secondary">
                - {source.label} ({source.type})
              </Typography>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
