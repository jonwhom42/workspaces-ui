import * as React from 'react';
import type { NextPage } from 'next';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { withAuth } from '../../../lib/authGuard';
import { getWorkspaceContext, type WorkspaceWithRole } from '../../../lib/workspaces';
import { getSupabaseServiceRoleClient } from '../../../lib/supabaseServer';

type WorkspaceDashboardProps = {
  workspace: WorkspaceWithRole;
  workspaces: WorkspaceWithRole[];
};

const WorkspaceDashboard: NextPage<WorkspaceDashboardProps> = ({ workspace }) => {
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

  const { workspace, workspaces } = await getWorkspaceContext(
    ctx.supabase,
    ctx.user.id,
    workspaceId,
    { fallbackClient: getSupabaseServiceRoleClient() },
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

  return {
    props: {
      workspace,
      workspaces,
      currentWorkspace: workspace,
    },
  };
});

export default WorkspaceDashboard;
