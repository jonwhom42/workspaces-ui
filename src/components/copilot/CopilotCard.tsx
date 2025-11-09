'use client';

import * as React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

type Mode = 'ask' | 'summarize' | 'reflect' | 'plan';

type Source = {
  type: string;
  ref: string;
  label: string;
};

type CopilotCardProps = {
  title: string;
  description?: string;
  workspaceId: string;
  seedId?: string;
  defaultMode?: Mode;
  enableSaveInsight?: boolean;
};

const modes: { value: Mode; label: string }[] = [
  { value: 'ask', label: 'Ask' },
  { value: 'summarize', label: 'Summarize' },
  { value: 'reflect', label: 'Reflect' },
  { value: 'plan', label: 'Plan' },
];

export function CopilotCard({
  title,
  description,
  workspaceId,
  seedId,
  defaultMode = 'ask',
  enableSaveInsight = false,
}: CopilotCardProps) {
  const [mode, setMode] = React.useState<Mode>(defaultMode);
  const [message, setMessage] = React.useState('');
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [sources, setSources] = React.useState<Source[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [savingInsight, setSavingInsight] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const askCopilot = async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch('/api/ai/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId,
          seedId,
          message,
          mode,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Copilot request failed');
      }
      setAnswer(payload.answer);
      setSources(payload.sources || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  const saveInsight = async () => {
    if (!answer || !seedId) {
      return;
    }
    setSavingInsight(true);
    setStatus(null);
    try {
      const response = await fetch('/api/insights/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          seedId,
          summary: answer.slice(0, 500),
          details: message,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to save insight');
      }
      setStatus('Insight saved');
    } catch (insightError) {
      setError(insightError instanceof Error ? insightError.message : 'Unable to save insight');
    } finally {
      setSavingInsight(false);
    }
  };

  return (
    <Card>
      <CardHeader title={title} subheader={description} />
      <CardContent>
        <Stack spacing={2}>
          <TextField
            label="Ask anything"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            multiline
            minRows={3}
          />
          <TextField
            select
            label="Mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as Mode)}
            size="small"
            sx={{ maxWidth: 200 }}
          >
            {modes.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button variant="contained" onClick={askCopilot} disabled={loading || !message.trim()}>
              {loading ? 'Thinking...' : 'Ask Copilot'}
            </Button>
            {enableSaveInsight && (
              <Button
                variant="outlined"
                onClick={saveInsight}
                disabled={!answer || !seedId || savingInsight}
              >
                {savingInsight ? 'Saving...' : 'Save as Insight'}
              </Button>
            )}
          </Stack>
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}
          {status && (
            <Typography color="success.main" variant="body2">
              {status}
            </Typography>
          )}
          {answer && (
            <Box sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Copilot Answer
              </Typography>
              <Typography sx={{ whiteSpace: 'pre-line' }}>{answer}</Typography>
              {sources.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">Sources</Typography>
                  {sources.map((source) => (
                    <Typography key={source.ref} variant="body2" color="text.secondary">
                      • {source.label} ({source.type})
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
