import * as React from 'react';
import type { NextPage } from 'next';
import { Box, Button, Card, CardContent, CardHeader, Container, Divider, Stack, TextField, Typography } from '@mui/material';
import { withAuth } from '../../../../lib/authGuard';
import { getWorkspaceContext } from '../../../../lib/workspaces';
import { getSeedById } from '../../../../lib/seeds';
import { getKnowledgeForSeed } from '../../../../lib/knowledge';
import { getSupabaseServiceRoleClient } from '../../../../lib/supabaseServer';
import type { WorkspaceWithRole } from '../../../../lib/workspaces';
import type { Seed, KnowledgeItem } from '../../../../types/db';
import { useRouter } from 'next/router';
import { CopilotCard } from '../../../../src/components/copilot/CopilotCard';

type SeedDetailProps = {
  workspace: WorkspaceWithRole;
  workspaces: WorkspaceWithRole[];
  seed: Seed;
  knowledge: KnowledgeItem[];
};

const SeedDetailPage: NextPage<SeedDetailProps> = ({ workspace, seed, knowledge }) => {
  const router = useRouter();
  const workspaceId = workspace.id;
  const seedId = seed.id;
  const [formState, setFormState] = React.useState({
    type: 'note',
    title: '',
    content: '',
    sourceUrl: '',
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleKnowledgeSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/knowledge/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          seedId,
          type: formState.type,
          title: formState.title,
          content: formState.content,
          sourceUrl: formState.sourceUrl,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to add knowledge');
      }
      router.replace(router.asPath);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={2} mb={4}>
        <Typography variant="overline" color="text.secondary">
          {workspace.name}
        </Typography>
        <Typography variant="h4">{seed.title}</Typography>
        <Typography color="text.secondary">{seed.why_it_matters || 'No summary yet.'}</Typography>
        <Stack direction="row" spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Status: {seed.status}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last updated: {new Date(seed.updated_at ?? seed.created_at).toLocaleString()}
          </Typography>
        </Stack>
      </Stack>

      <Stack spacing={3}>
        <Card>
          <CardHeader title="Knowledge" />
          <CardContent>
            {knowledge.length === 0 ? (
              <Typography color="text.secondary">No knowledge captured yet.</Typography>
            ) : (
              <Stack spacing={2}>
                {knowledge.map((item) => (
                  <Box key={item.id} sx={{ border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 1 }}>
                    <Typography variant="subtitle2">{item.title || item.type}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.content || item.source_url || 'No details'}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle1" gutterBottom>
              Add Knowledge
            </Typography>
            <Box component="form" onSubmit={handleKnowledgeSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Title"
                value={formState.title}
                onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
              />
              <TextField
                label="Content"
                multiline
                minRows={3}
                value={formState.content}
                onChange={(event) => setFormState((prev) => ({ ...prev, content: event.target.value }))}
              />
              <TextField
                label="Source URL"
                value={formState.sourceUrl}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, sourceUrl: event.target.value }))
                }
              />
              {error && (
                <Typography color="error" variant="body2">
                  {error}
                </Typography>
              )}
              <Button type="submit" variant="contained" disabled={submitting}>
                {submitting ? 'Saving...' : 'Add knowledge'}
              </Button>
            </Box>
          </CardContent>
        </Card>

        <CopilotCard
          title="Seed Copilot"
          description="Ask grounded questions about this seed."
          workspaceId={workspace.id}
          seedId={seed.id}
          enableSaveInsight
        />

        <Card>
          <CardHeader title="Experiments" subheader="Track hypotheses and runs (coming soon)." />
          <CardContent>
            <Typography color="text.secondary">
              Experiments will show up here once added.
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Principles" subheader="Codify guardrails." />
          <CardContent>
            <Typography color="text.secondary">
              Capture principles to guide how Seeds evolve. UI placeholder for now.
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Insights" subheader="Distilled learnings." />
          <CardContent>
            <Typography color="text.secondary">
              Insights generated by experiments, conversations, or copilot will appear here.
            </Typography>
          </CardContent>
        </Card>
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

  const knowledge = await getKnowledgeForSeed(ctx.supabase, workspaceId, ctx.user.id, seedId, {
    fallbackClient: serviceRole,
  });

  return {
    props: {
      workspace,
      workspaces,
      currentWorkspace: workspace,
      seed,
      knowledge,
    },
  };
});

export default SeedDetailPage;
