import * as React from 'react';
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
import type {
  CopilotLens,
  CopilotMessage,
  CopilotStructuredSuggestion,
} from '../../../lib/aiClient';

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
  structured?: CopilotStructuredSuggestion;
};

type InsightHandlerPayload = {
  answer: string;
  suggestion?: CopilotStructuredSuggestion;
};

type CopilotPanelProps = {
  workspaceId: string;
  seedId?: string;
  modeOptions?: Mode[];
  lensOptions?: Lens[];
  initialMessages?: CopilotMessage[];
  onDistillToSeed?: (messages: CopilotMessage[]) => Promise<void> | void;
  onAcceptSeedProposal?: (draft: { title: string; summary?: string; why_it_matters?: string }) =>
    | Promise<void>
    | void;
  onSaveInsight?: (payload: InsightHandlerPayload) => Promise<void> | void;
  onCreateExperiment?: (payload: InsightHandlerPayload) => Promise<void> | void;
};

export function CopilotPanel({
  workspaceId,
  seedId,
  modeOptions = ['ask', 'summarize', 'plan', 'reflect'],
  lensOptions = ['explore', 'distill', 'design', 'mirror'],
  initialMessages = [],
  onDistillToSeed,
  onAcceptSeedProposal,
  onSaveInsight,
  onCreateExperiment,
}: CopilotPanelProps) {
  const [messages, setMessages] = React.useState<CopilotMessage[]>(initialMessages);
  const [input, setInput] = React.useState('');
  const [mode, setMode] = React.useState<Mode>('ask');
  const [lens, setLens] = React.useState<Lens>('explore');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sources, setSources] = React.useState<Source[]>([]);
  const [structured, setStructured] = React.useState<CopilotStructuredSuggestion | null>(null);
  const [actionStatus, setActionStatus] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId,
          seedId,
          mode,
          lens,
          messages: newMessages,
        }),
      });
      const payload = (await response.json()) as CopilotResponsePayload & { error?: string };
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

  const handleDistill = async () => {
    if (!onDistillToSeed) return;
    setActionLoading(true);
    setActionStatus(null);
    try {
      await onDistillToSeed(messages);
      setActionStatus('Seed created from conversation');
    } catch (distillError) {
      setError(distillError instanceof Error ? distillError.message : 'Unable to distill seed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptSeedProposal = async () => {
    if (!onAcceptSeedProposal || !structured || structured.mode !== 'seed_proposal' || !structured.structured) {
      return;
    }
    setActionLoading(true);
    setActionStatus(null);
    try {
      await onAcceptSeedProposal({
        title: structured.structured.title,
        summary: structured.structured.summary,
        why_it_matters: structured.structured.why_it_matters,
      });
      setActionStatus('Seed created');
    } catch (seedError) {
      setError(seedError instanceof Error ? seedError.message : 'Unable to create seed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveInsight = async () => {
    if (!onSaveInsight || !lastAssistantMessage) return;
    setActionLoading(true);
    setActionStatus(null);
    try {
      await onSaveInsight({
        answer: lastAssistantMessage.content,
        suggestion: structured?.mode === 'insight' ? structured : undefined,
      });
      setActionStatus('Saved as insight');
    } catch (insightError) {
      setError(insightError instanceof Error ? insightError.message : 'Unable to save insight');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateExperiment = async () => {
    if (!onCreateExperiment || !lastAssistantMessage) return;
    setActionLoading(true);
    setActionStatus(null);
    try {
      await onCreateExperiment({
        answer: lastAssistantMessage.content,
        suggestion: structured?.mode === 'experiment_suggestion' ? structured : undefined,
      });
      setActionStatus('Experiment created');
    } catch (experimentError) {
      setError(experimentError instanceof Error ? experimentError.message : 'Unable to create experiment');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Card variant="outlined">
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box
          ref={scrollRef}
          sx={{
            maxHeight: 400,
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
            <Stack spacing={1.5}>
              {messages.map((message, index) => (
                <Box
                  key={`${message.role}-${index}-${message.content.slice(0, 8)}`}
                  sx={{
                    alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '90%',
                    backgroundColor: message.role === 'user' ? 'primary.main' : 'background.paper',
                    color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                    borderRadius: 2,
                    px: 2,
                    py: 1.5,
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Box>

        <Stack spacing={1}>
          <TextField
            select
            label="Lens"
            size="small"
            sx={{ maxWidth: 220 }}
            value={lens}
            onChange={(event) => setLens(event.target.value as Lens)}
          >
            {lensOptions.map((option) => (
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
            {modeOptions.map((option) => (
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
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button variant="contained" onClick={sendMessage} disabled={isLoading || !input.trim()}>
              {isLoading ? 'Thinking...' : 'Send'}
            </Button>
            {!seedId && onDistillToSeed && messages.length > 0 && (
              <Button variant="outlined" onClick={handleDistill} disabled={actionLoading}>
                Distill into Seed
              </Button>
            )}
            {!seedId &&
              structured &&
              structured.mode === 'seed_proposal' &&
              structured.structured &&
              onAcceptSeedProposal && (
              <Button onClick={handleAcceptSeedProposal} disabled={actionLoading}>
                Create seed from suggestion
              </Button>
            )}
            {seedId && lastAssistantMessage && onSaveInsight && (
              <Button variant="outlined" onClick={handleSaveInsight} disabled={actionLoading}>
                Save as Insight
              </Button>
            )}
            {seedId && lastAssistantMessage && onCreateExperiment && (
              <Button onClick={handleCreateExperiment} disabled={actionLoading}>
                Create Experiment
              </Button>
            )}
          </Stack>
        </Stack>

        {structured && structured.mode !== 'generic_answer' && (
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Structured suggestion
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }} gutterBottom>
              {structured.content}
            </Typography>
            {structured.mode === 'seed_proposal' && structured.structured && (
              <Stack spacing={0.5}>
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
              </Stack>
            )}
            {structured.mode === 'insight' && structured.structured && (
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  <strong>Summary:</strong> {structured.structured.summary}
                </Typography>
                {structured.structured.details && (
                  <Typography variant="body2">
                    <strong>Details:</strong> {structured.structured.details}
                  </Typography>
                )}
                {typeof structured.structured.confidence === 'number' && (
                  <Typography variant="body2">
                    <strong>Confidence:</strong> {structured.structured.confidence}
                  </Typography>
                )}
              </Stack>
            )}
            {structured.mode === 'experiment_suggestion' && structured.structured && (
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  <strong>Title:</strong> {structured.structured.title}
                </Typography>
                {structured.structured.hypothesis && (
                  <Typography variant="body2">
                    <strong>Hypothesis:</strong> {structured.structured.hypothesis}
                  </Typography>
                )}
                {structured.structured.plan && (
                  <Typography variant="body2">
                    <strong>Plan:</strong> {structured.structured.plan}
                  </Typography>
                )}
              </Stack>
            )}
            {structured.mode === 'principle_suggestion' && structured.structured && (
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  <strong>Statement:</strong> {structured.structured.statement}
                </Typography>
                {structured.structured.category && (
                  <Typography variant="body2">
                    <strong>Category:</strong> {structured.structured.category}
                  </Typography>
                )}
              </Stack>
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
                • {source.label} ({source.type})
              </Typography>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
