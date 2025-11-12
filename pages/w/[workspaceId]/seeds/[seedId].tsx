import * as React from 'react';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Container,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { withAuth } from '../../../../lib/authGuard';
import { getWorkspaceContext, type WorkspaceWithRole } from '../../../../lib/workspaces';
import { getSeedById } from '../../../../lib/seeds';
import { getKnowledgeForSeed } from '../../../../lib/knowledge';
import { getInsightsForSeed } from '../../../../lib/insights';
import { getExperimentsForSeed } from '../../../../lib/experiments';
import { getPrinciplesForSeed } from '../../../../lib/principles';
import { getSupabaseServiceRoleClient } from '../../../../lib/supabaseServer';
import type { Seed, KnowledgeItem, Insight, Experiment, Principle } from '../../../../types/db';
import { CopilotPanel } from '../../../../src/components/copilot/CopilotPanel';

type SeedDetailProps = {
  workspace: WorkspaceWithRole;
  workspaces: WorkspaceWithRole[];
  seed: Seed;
  knowledge: KnowledgeItem[];
  insights: Insight[];
  experiments: Experiment[];
  principles: Principle[];
};

type SeedStewardSuggestions = {
  summary_update?: {
    new_summary: string;
    reason: string;
  };
  insight_suggestions?: {
    summary: string;
    details?: string;
    confidence?: number;
  }[];
  experiment_suggestions?: {
    title: string;
    hypothesis?: string;
    plan?: string;
  }[];
  principle_suggestions?: {
    statement: string;
    category?: string;
  }[];
};

const SeedDetailPage: NextPage<SeedDetailProps> = ({
  workspace,
  seed,
  knowledge,
  insights,
  experiments,
  principles,
}) => {
  const router = useRouter();
  const workspaceId = workspace.id;
  const seedId = seed.id;
  const [seedState, setSeedState] = React.useState(seed);
  const [formState, setFormState] = React.useState({
    title: '',
    content: '',
    sourceUrl: '',
  });
  const [savingKnowledge, setSavingKnowledge] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [stewardSuggestions, setStewardSuggestions] = React.useState<SeedStewardSuggestions | null>(null);
  const [stewardLoading, setStewardLoading] = React.useState(false);
  const [stewardActionLoading, setStewardActionLoading] = React.useState(false);
  const [stewardError, setStewardError] = React.useState<string | null>(null);
  const [stewardFetched, setStewardFetched] = React.useState(false);

  const refreshStewardSuggestions = async () => {
    setStewardLoading(true);
    setStewardError(null);
    try {
      const response = await fetch('/api/ai/seed-steward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, seedId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to load suggestions');
      }
      setStewardSuggestions(payload.suggestions ?? null);
      setStewardFetched(true);
    } catch (suggestionError) {
      setStewardError(
        suggestionError instanceof Error ? suggestionError.message : 'Unable to load suggestions',
      );
      setStewardFetched(true);
    } finally {
      setStewardLoading(false);
    }
  };

  const updateSuggestions = (
    updater: (previous: SeedStewardSuggestions | null) => SeedStewardSuggestions | null,
  ) => {
    setStewardSuggestions((prev) => {
      const next = updater(prev);
      if (!next) {
        return null;
      }
      const hasContent =
        next.summary_update ||
        (next.insight_suggestions && next.insight_suggestions.length > 0) ||
        (next.experiment_suggestions && next.experiment_suggestions.length > 0) ||
        (next.principle_suggestions && next.principle_suggestions.length > 0);
      return hasContent ? next : null;
    });
  };

  const removeSuggestion = (type: keyof SeedStewardSuggestions, index?: number) => {
    updateSuggestions((previous) => {
      if (!previous) return previous;
      if (type === 'summary_update') {
        const next = { ...previous };
        delete next.summary_update;
        return next;
      }
      if (type === 'insight_suggestions') {
        if (!previous.insight_suggestions) return previous;
        const updated = previous.insight_suggestions.filter((_, idx) => idx !== index);
        const next = { ...previous };
        if (updated.length) {
          next.insight_suggestions = updated;
        } else {
          delete next.insight_suggestions;
        }
        return next;
      }
      if (type === 'experiment_suggestions') {
        if (!previous.experiment_suggestions) return previous;
        const updated = previous.experiment_suggestions.filter((_, idx) => idx !== index);
        const next = { ...previous };
        if (updated.length) {
          next.experiment_suggestions = updated;
        } else {
          delete next.experiment_suggestions;
        }
        return next;
      }
      if (type === 'principle_suggestions') {
        if (!previous.principle_suggestions) return previous;
        const updated = previous.principle_suggestions.filter((_, idx) => idx !== index);
        const next = { ...previous };
        if (updated.length) {
          next.principle_suggestions = updated;
        } else {
          delete next.principle_suggestions;
        }
        return next;
      }
      return previous;
    });
  };

  const applySummarySuggestion = async () => {
    const summaryUpdate = stewardSuggestions?.summary_update;
    if (!summaryUpdate) return;
    setStewardActionLoading(true);
    setStewardError(null);
    try {
      const response = await fetch('/api/seeds/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          seedId,
          summary: summaryUpdate.new_summary,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to update seed');
      }
      setSeedState(payload.seed);
      removeSuggestion('summary_update');
    } catch (updateError) {
      setStewardError(updateError instanceof Error ? updateError.message : 'Unable to update seed');
    } finally {
      setStewardActionLoading(false);
    }
  };

  const applyInsightSuggestion = async (index: number) => {
    const suggestion = stewardSuggestions?.insight_suggestions?.[index];
    if (!suggestion) return;
    setStewardActionLoading(true);
    setStewardError(null);
    try {
      const response = await fetch('/api/insights/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          seedId,
          summary: suggestion.summary,
          details: suggestion.details ?? null,
          confidence: suggestion.confidence ?? null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to save insight');
      }
      removeSuggestion('insight_suggestions', index);
      router.replace(router.asPath);
    } catch (applyError) {
      setStewardError(applyError instanceof Error ? applyError.message : 'Unable to save insight');
    } finally {
      setStewardActionLoading(false);
    }
  };

  const applyExperimentSuggestion = async (index: number) => {
    const suggestion = stewardSuggestions?.experiment_suggestions?.[index];
    if (!suggestion) return;
    setStewardActionLoading(true);
    setStewardError(null);
    try {
      const response = await fetch('/api/experiments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          seedId,
          title: suggestion.title,
          hypothesis: suggestion.hypothesis ?? null,
          plan: suggestion.plan ?? null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to create experiment');
      }
      removeSuggestion('experiment_suggestions', index);
      router.replace(router.asPath);
    } catch (applyError) {
      setStewardError(
        applyError instanceof Error ? applyError.message : 'Unable to create experiment',
      );
    } finally {
      setStewardActionLoading(false);
    }
  };

  const applyPrincipleSuggestion = async (index: number) => {
    const suggestion = stewardSuggestions?.principle_suggestions?.[index];
    if (!suggestion) return;
    setStewardActionLoading(true);
    setStewardError(null);
    try {
      const response = await fetch('/api/principles/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          seedId,
          statement: suggestion.statement,
          category: suggestion.category ?? null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to add principle');
      }
      removeSuggestion('principle_suggestions', index);
      router.replace(router.asPath);
    } catch (applyError) {
      setStewardError(
        applyError instanceof Error ? applyError.message : 'Unable to add principle',
      );
    } finally {
      setStewardActionLoading(false);
    }
  };

  const handleKnowledgeSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingKnowledge(true);
    setError(null);
    try {
      const response = await fetch('/api/knowledge/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          seedId,
          type: 'note',
          title: formState.title,
          content: formState.content,
          sourceUrl: formState.sourceUrl,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to add knowledge');
      }
      setFormState({ title: '', content: '', sourceUrl: '' });
      router.replace(router.asPath);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to add knowledge');
    } finally {
      setSavingKnowledge(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h3" sx={{ fontWeight: 600 }}>
            {seedState.title}
          </Typography>
          <Typography color="text.secondary">
            {seedState.why_it_matters || 'No narrative yet.'}
          </Typography>
          <Typography color="text.secondary">
            Status: {seedState.status} · Updated{' '}
            {new Date(seedState.updated_at ?? seedState.created_at).toLocaleString()}
          </Typography>
        </Stack>

        <Box
          display="grid"
          gridTemplateColumns={{ xs: '1fr', lg: '3fr 2fr' }}
          gap={4}
          alignItems="start"
        >
          <Stack spacing={3}>
            <Card variant="outlined">
              <CardHeader title="Knowledge" />
              <CardContent>
                {knowledge.length === 0 ? (
                  <Typography color="text.secondary">No knowledge captured yet.</Typography>
                ) : (
                  <Stack spacing={2} mb={3}>
                    {knowledge.map((item) => (
                      <Box key={item.id} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                        <Typography variant="subtitle2">{item.title || 'Entry'}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.content || item.source_url || 'No details'}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
                <Typography variant="subtitle2" gutterBottom>
                  Add knowledge
                </Typography>
                <Box component="form" onSubmit={handleKnowledgeSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="Title"
                    value={formState.title}
                    onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                  />
                  <TextField
                    label="Details"
                    multiline
                    minRows={3}
                    value={formState.content}
                    onChange={(event) => setFormState((prev) => ({ ...prev, content: event.target.value }))}
                  />
                  <TextField
                    label="Source URL"
                    value={formState.sourceUrl}
                    onChange={(event) => setFormState((prev) => ({ ...prev, sourceUrl: event.target.value }))}
                  />
                  {error && (
                    <Typography color="error" variant="body2">
                      {error}
                    </Typography>
                  )}
                  <Button type="submit" variant="contained" disabled={savingKnowledge}>
                    {savingKnowledge ? 'Saving...' : 'Add knowledge'}
                  </Button>
                </Box>
            </CardContent>
          </Card>

          {principles.length > 0 && (
            <Card variant="outlined">
              <CardHeader title="Principles" />
              <CardContent>
                <Stack spacing={2}>
                  {principles.map((principle) => (
                    <Box
                      key={principle.id}
                      sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}
                    >
                      <Typography variant="subtitle2">{principle.statement}</Typography>
                      {principle.category && (
                        <Typography variant="body2" color="text.secondary">
                          Category: {principle.category}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        Added {new Date(principle.created_at).toLocaleString()}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}

          {experiments.length > 0 && (
            <Card variant="outlined">
              <CardHeader title="Experiments" />
                <CardContent>
                  <Stack spacing={2}>
                    {experiments.map((experiment) => (
                      <Box key={experiment.id} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                        <Typography variant="subtitle2">{experiment.title}</Typography>
                        {experiment.plan && (
                          <Typography variant="body2" color="text.secondary">
                            {experiment.plan}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          Status: {experiment.status}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}

            {insights.length > 0 && (
              <Card variant="outlined">
                <CardHeader title="Insights" />
                <CardContent>
                  <Stack spacing={2}>
                    {insights.map((insight) => (
                      <Box key={insight.id} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                        <Typography variant="subtitle2">{insight.summary}</Typography>
                        {insight.details && (
                          <Typography variant="body2" color="text.secondary">
                            {insight.details}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          Saved {new Date(insight.created_at).toLocaleString()}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>

          <Stack spacing={3}>
            <CopilotPanel
              workspaceId={workspace.id}
              seedId={seed.id}
              lensDefault="distill"
              modeDefault="ask"
            />

            <Card variant="outlined">
              <CardHeader
                title="Seed Steward suggestions"
                action={
                  <Button size="small" onClick={refreshStewardSuggestions} disabled={stewardLoading}>
                    {stewardLoading ? 'Loading...' : 'Refresh'}
                  </Button>
                }
              />
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {stewardError && (
                  <Typography color="error" variant="body2">
                    {stewardError}
                  </Typography>
                )}
                {!stewardFetched && !stewardSuggestions && !stewardLoading && (
                  <Typography color="text.secondary">
                    Run the steward to see proposed updates grounded in recent knowledge.
                  </Typography>
                )}
                {stewardFetched && !stewardSuggestions && !stewardLoading && !stewardError && (
                  <Typography color="text.secondary">No new suggestions right now.</Typography>
                )}
                {stewardSuggestions?.summary_update && (
                  <Box
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: 2,
                    }}
                  >
                    <Typography variant="subtitle2" gutterBottom>
                      Summary update
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }} gutterBottom>
                      {stewardSuggestions.summary_update.new_summary}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                      Reason: {stewardSuggestions.summary_update.reason}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={applySummarySuggestion}
                        disabled={stewardActionLoading}
                      >
                        Apply summary
                      </Button>
                      <Button
                        size="small"
                        onClick={() => removeSuggestion('summary_update')}
                        disabled={stewardActionLoading}
                      >
                        Dismiss
                      </Button>
                    </Stack>
                  </Box>
                )}

                {stewardSuggestions?.insight_suggestions?.map((suggestion, index) => (
                  <Box
                    key={`insight-${index}`}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}
                  >
                    <Typography variant="subtitle2">Insight suggestion</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }} gutterBottom>
                      {suggestion.summary}
                    </Typography>
                    {suggestion.details && (
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {suggestion.details}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => applyInsightSuggestion(index)}
                        disabled={stewardActionLoading}
                      >
                        Save insight
                      </Button>
                      <Button
                        size="small"
                        onClick={() => removeSuggestion('insight_suggestions', index)}
                        disabled={stewardActionLoading}
                      >
                        Dismiss
                      </Button>
                    </Stack>
                  </Box>
                ))}

                {stewardSuggestions?.experiment_suggestions?.map((suggestion, index) => (
                  <Box
                    key={`experiment-${index}`}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}
                  >
                    <Typography variant="subtitle2">Experiment suggestion</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {suggestion.title}
                    </Typography>
                    {suggestion.hypothesis && (
                      <Typography variant="body2" color="text.secondary">
                        Hypothesis: {suggestion.hypothesis}
                      </Typography>
                    )}
                    {suggestion.plan && (
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Plan: {suggestion.plan}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => applyExperimentSuggestion(index)}
                        disabled={stewardActionLoading}
                      >
                        Create experiment
                      </Button>
                      <Button
                        size="small"
                        onClick={() => removeSuggestion('experiment_suggestions', index)}
                        disabled={stewardActionLoading}
                      >
                        Dismiss
                      </Button>
                    </Stack>
                  </Box>
                ))}

                {stewardSuggestions?.principle_suggestions?.map((suggestion, index) => (
                  <Box
                    key={`principle-${index}`}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}
                  >
                    <Typography variant="subtitle2">Principle suggestion</Typography>
                    <Typography variant="body2" gutterBottom>
                      {suggestion.statement}
                    </Typography>
                    {suggestion.category && (
                      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        Category: {suggestion.category}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => applyPrincipleSuggestion(index)}
                        disabled={stewardActionLoading}
                      >
                        Add principle
                      </Button>
                      <Button
                        size="small"
                        onClick={() => removeSuggestion('principle_suggestions', index)}
                        disabled={stewardActionLoading}
                      >
                        Dismiss
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Stack>
    </Container>
  );
};

export const getServerSideProps = withAuth(async (ctx) => {
  const workspaceId = ctx.params?.workspaceId;
  const seedId = ctx.params?.seedId;

  if (typeof workspaceId !== 'string' || typeof seedId !== 'string') {
    return {
      redirect: {
        destination: '/app',
        permanent: false,
      },
    };
  }

  const serviceRole = getSupabaseServiceRoleClient();
  const { workspace, workspaces } = await getWorkspaceContext(
    ctx.supabase,
    ctx.user.id,
    workspaceId,
    { fallbackClient: serviceRole },
  );

  if (!workspace) {
    return { notFound: true };
  }

  const seed = await getSeedById(ctx.supabase, workspaceId, ctx.user.id, seedId, {
    fallbackClient: serviceRole,
  });

  if (!seed) {
    return { notFound: true };
  }

  const [knowledge, insights, experiments, principles] = await Promise.all([
    getKnowledgeForSeed(ctx.supabase, workspaceId, ctx.user.id, seedId, {
      fallbackClient: serviceRole,
    }),
    getInsightsForSeed(ctx.supabase, workspaceId, ctx.user.id, seedId, {
      fallbackClient: serviceRole,
    }),
    getExperimentsForSeed(ctx.supabase, workspaceId, ctx.user.id, seedId, {
      fallbackClient: serviceRole,
    }),
    getPrinciplesForSeed(ctx.supabase, workspaceId, ctx.user.id, seedId, {
      fallbackClient: serviceRole,
    }),
  ]);

  return {
    props: {
      workspace,
      workspaces,
      currentWorkspace: workspace,
      seed,
      knowledge,
      insights,
      experiments,
      principles,
    },
  };
});

export default SeedDetailPage;
