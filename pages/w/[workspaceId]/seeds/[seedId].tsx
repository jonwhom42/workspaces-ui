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
import { getSupabaseServiceRoleClient } from '../../../../lib/supabaseServer';
import type { Seed, KnowledgeItem, Insight, Experiment } from '../../../../types/db';
import { CopilotPanel } from '../../../../src/components/copilot/CopilotPanel';
import type { CopilotStructuredSuggestion } from '../../../../lib/aiClient';

type SeedDetailProps = {
  workspace: WorkspaceWithRole;
  workspaces: WorkspaceWithRole[];
  seed: Seed;
  knowledge: KnowledgeItem[];
  insights: Insight[];
  experiments: Experiment[];
};

type CopilotActionPayload = {
  answer: string;
  suggestion?: CopilotStructuredSuggestion;
};

const SeedDetailPage: NextPage<SeedDetailProps> = ({
  workspace,
  seed,
  knowledge,
  insights,
  experiments,
}) => {
  const router = useRouter();
  const workspaceId = workspace.id;
  const seedId = seed.id;
  const [formState, setFormState] = React.useState({
    title: '',
    content: '',
    sourceUrl: '',
  });
  const [savingKnowledge, setSavingKnowledge] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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

  const handleSaveInsight = async ({ answer, suggestion }: CopilotActionPayload) => {
    const insightSuggestion =
      suggestion?.mode === 'insight' ? suggestion.structured : undefined;
    const summary = insightSuggestion?.summary || answer.slice(0, 280);
    const details = insightSuggestion?.details;
    const confidence =
      typeof insightSuggestion?.confidence === 'number'
        ? insightSuggestion.confidence
        : undefined;
    const response = await fetch('/api/insights/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, seedId, summary, details, confidence }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to save insight');
    }
    router.replace(router.asPath);
  };

  const handleCreateExperiment = async ({ answer, suggestion }: CopilotActionPayload) => {
    const structuredExperiment =
      suggestion?.mode === 'experiment_suggestion' ? suggestion.structured : undefined;
    const fallbackTitle = `Experiment idea ${new Date().toLocaleString()}`;
    const response = await fetch('/api/experiments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId,
        seedId,
        title: structuredExperiment?.title || fallbackTitle,
        hypothesis: structuredExperiment?.hypothesis,
        plan: structuredExperiment?.plan ?? answer,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to create experiment');
    }
    router.replace(router.asPath);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h3" sx={{ fontWeight: 600 }}>
            {seed.title}
          </Typography>
          <Typography color="text.secondary">{seed.why_it_matters || 'No narrative yet.'}</Typography>
          <Typography color="text.secondary">
            Status: {seed.status} · Updated {new Date(seed.updated_at ?? seed.created_at).toLocaleString()}
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

          <CopilotPanel
            workspaceId={workspace.id}
            seedId={seed.id}
            onSaveInsight={handleSaveInsight}
            onCreateExperiment={handleCreateExperiment}
          />
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

  const [knowledge, insights, experiments] = await Promise.all([
    getKnowledgeForSeed(ctx.supabase, workspaceId, ctx.user.id, seedId, {
      fallbackClient: serviceRole,
    }),
    getInsightsForSeed(ctx.supabase, workspaceId, ctx.user.id, seedId, {
      fallbackClient: serviceRole,
    }),
    getExperimentsForSeed(ctx.supabase, workspaceId, ctx.user.id, seedId, {
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
    },
  };
});

export default SeedDetailPage;
