import * as React from 'react';
import type { NextPage } from 'next';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { withAuth } from '../../../lib/authGuard';
import { getWorkspaceContext, type WorkspaceWithRole } from '../../../lib/workspaces';
import { getSupabaseServiceRoleClient } from '../../../lib/supabaseServer';
import { getSeedsForWorkspace } from '../../../lib/seeds';
import type { Seed } from '../../../types/db';
import { CopilotCard } from '../../../src/components/copilot/CopilotCard';

type WorkspaceDashboardProps = {
  workspace: WorkspaceWithRole;
  workspaces: WorkspaceWithRole[];
  seeds: Seed[];
};

const WorkspaceDashboard: NextPage<WorkspaceDashboardProps> = ({ workspace, seeds }) => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="overline" color="text.secondary">
            {workspace.name}
          </Typography>
          <Typography variant="h4">Dashboard</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
            Wire up your primary metrics, charts, and narratives to keep the entire team aligned.
            The cards below are placeholders scoped to this workspace.
          </Typography>
        </Stack>

        <Box
          display="grid"
          gridTemplateColumns={{ xs: '1fr', md: '2fr 1fr' }}
          gap={3}
          alignItems="stretch"
        >
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardHeader
              title="Activity Stream"
              subheader="Use this wide canvas for charts, feeds, or any bespoke visualization."
            />
            <CardContent>
              <Typography color="text.secondary">
                Visualize recent observations or events here. This layout matches the dashboard card
                guidance from Material UI and keeps typography spacing consistent.
              </Typography>
            </CardContent>
          </Card>

          <Stack spacing={3}>
            <Card variant="outlined">
              <CardHeader title="Alerts" />
              <CardContent>
                <Typography color="text.secondary">
                  Surface blockers, risks, or signals that need immediate attention.
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined">
              <CardHeader title="Notes" />
              <CardContent>
                <Typography color="text.secondary">
                  Capture key decisions or leave quick context for collaborators.
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Box>

        <Card variant="outlined">
          <CardHeader title="Upcoming Deliverables" />
          <CardContent>
            <Typography color="text.secondary">
              Reserve this space for timelines, schedules, or kanban views that keep delivery on
              track.
            </Typography>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardHeader
            title="Your Seeds"
            subheader="Top ideas this workspace is nurturing"
            action={
              <Button component={Link} href={`/w/${workspace.id}/seeds`} variant="outlined" size="small">
                View all
              </Button>
            }
          />
          <CardContent>
            {seeds.length === 0 ? (
              <Typography color="text.secondary">
                No seeds yet.{' '}
                <Button component={Link} href={`/w/${workspace.id}/seeds`} size="small">
                  Create one now
                </Button>
              </Typography>
            ) : (
              <Stack spacing={2}>
                {seeds.map((seed) => (
                  <Box
                    key={seed.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: 2,
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={600}>
                      {seed.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {seed.summary || 'No summary yet'}
                    </Typography>
                    <Button
                      component={Link}
                      href={`/w/${workspace.id}/seeds/${seed.id}`}
                      size="small"
                    >
                      Open Seed
                    </Button>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        <CopilotCard
          title="Workspace Copilot"
          description="Ask questions about this workspace across all seeds."
          workspaceId={workspace.id}
        />
      </Stack>
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

  console.info('[pages/w/dashboard] workspace lookup', {
    userId: ctx.user.id,
    workspaceId,
    found: Boolean(workspace),
    totalWorkspaces: workspaces.length,
  });

  if (!workspace) {
    return {
      notFound: true,
    };
  }

  const seeds = await getSeedsForWorkspace(ctx.supabase, workspaceId, ctx.user.id, {
    fallbackClient: serviceRole,
  });

  return {
    props: {
      workspace,
      workspaces,
      currentWorkspace: workspace,
      seeds: seeds.slice(0, 3),
    },
  };
});

export default WorkspaceDashboard;
