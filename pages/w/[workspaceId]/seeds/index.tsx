import * as React from 'react';
import type { NextPage } from 'next';
import { Box, Container, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { withAuth } from '../../../../lib/authGuard';
import { getWorkspaceContext } from '../../../../lib/workspaces';
import { getSeedsForWorkspace } from '../../../../lib/seeds';
import { getSupabaseServiceRoleClient } from '../../../../lib/supabaseServer';
import type { WorkspaceWithRole } from '../../../../lib/workspaces';
import type { Seed } from '../../../../types/db';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { CopilotPanel } from '../../../../src/components/copilot/CopilotPanel';

type SeedsPageProps = {
  workspace: WorkspaceWithRole;
  workspaces: WorkspaceWithRole[];
  seeds: Seed[];
};

const SeedsPage: NextPage<SeedsPageProps> = ({ workspace, workspaces, seeds }) => {
  const router = useRouter();
  const workspaceId = workspace.id;

  const handleAcceptSeedProposal = async (draft: { title: string; summary?: string; why_it_matters?: string }) => {
    const response = await fetch('/api/seeds/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId,
        title: draft.title,
        summary: draft.summary,
        whyItMatters: draft.why_it_matters,
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload?.seed?.id) {
      throw new Error(payload.error || 'Unable to create seed');
    }
    router.push(`/w/${workspaceId}/seeds/${payload.seed.id}`);
  };
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={2} mb={4}>
        <Typography variant="overline" color="text.secondary">
          {workspace.name}
        </Typography>
        <Typography variant="h4">Seeds</Typography>
        <Typography color="text.secondary">
          Seeds capture the ideas, goals, or hypotheses this workspace is actively tending to.
        </Typography>
      </Stack>

      <Box sx={{ mb: 4 }}>
        <CopilotPanel
          workspaceId={workspaceId}
          onDistillToSeed={async (conversation) => {
            const response = await fetch('/api/seeds/from-conversation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ workspaceId, messages: conversation }),
            });
            const payload = await response.json();
            if (!response.ok) {
              throw new Error(payload.error || 'Unable to create seed');
            }
            router.push(`/w/${workspaceId}/seeds/${payload.seedId}`);
          }}
          onAcceptSeedProposal={handleAcceptSeedProposal}
        />
      </Box>

      {seeds.length === 0 ? (
        <Box
          sx={{
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
          }}
        >
          <Typography variant="h6">No seeds yet</Typography>
          <Typography color="text.secondary">
            Start by describing an idea above — Copilot will propose the first seed.
          </Typography>
        </Box>
      ) : (
        <List>
          {seeds.map((seed) => (
            <ListItem
              key={seed.id}
              divider
              component={Link}
              href={`/w/${workspaceId}/seeds/${seed.id}`}
              sx={{
                borderRadius: 1,
                mb: 1,
                '&:hover': { backgroundColor: 'action.hover' },
              }}
            >
              <ListItemText
                primary={
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontWeight={600}>{seed.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {seed.status}
                    </Typography>
                  </Stack>
                }
                secondary={
                  seed.summary ||
                  `Updated ${new Date(seed.updated_at ?? seed.created_at).toLocaleString()}`
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Container>
  );
};

export const getServerSideProps = withAuth(async (ctx) => {
  const workspaceId = ctx.params?.workspaceId;

  if (typeof workspaceId !== 'string') {
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

  const seeds = await getSeedsForWorkspace(ctx.supabase, workspaceId, ctx.user.id, {
    fallbackClient: serviceRole,
  });

  return {
    props: {
      workspace,
      workspaces,
      currentWorkspace: workspace,
      seeds,
    },
  };
});

export default SeedsPage;
