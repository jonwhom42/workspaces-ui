import * as React from 'react';
import type { NextPage } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { withAuth } from '../../../lib/authGuard';
import { getWorkspaceContext, type WorkspaceWithRole } from '../../../lib/workspaces';
import { getSupabaseServiceRoleClient } from '../../../lib/supabaseServer';
import { getSeedsForWorkspace } from '../../../lib/seeds';
import type { Seed } from '../../../types/db';
import { CopilotPanel } from '../../../src/components/copilot/CopilotPanel';

type WorkspaceDashboardProps = {
  workspace: WorkspaceWithRole;
  workspaces: WorkspaceWithRole[];
  seeds: Seed[];
};

const WorkspaceDashboard: NextPage<WorkspaceDashboardProps> = ({ workspace, seeds }) => {
  const router = useRouter();
  const [showIdeaBuilder, setShowIdeaBuilder] = React.useState(false);
  const workspaceId = workspace.id;

  const handleSeedCreated = async (seedId: string) => {
    await router.push(`/w/${workspaceId}/seeds/${seedId}`);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={4}>
        <Typography variant="h3" sx={{ fontWeight: 600 }}>
          {workspace.name}
        </Typography>

        <Box display="flex" justifyContent="flex-end" gap={2}>
          <Button variant="outlined" onClick={() => router.push(`/w/${workspaceId}/seeds`)}>
            View all
          </Button>
          <Button variant="contained" onClick={() => setShowIdeaBuilder((prev) => !prev)}>
            {showIdeaBuilder ? 'Hide idea builder' : 'Start a new idea'}
          </Button>
        </Box>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Seeds
            </Typography>
            {seeds.length === 0 ? (
              <Typography color="text.secondary">
                No seeds yet. Use "Start a new idea" to draft your first one.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {seeds.map((seed) => (
                  <Box
                    key={seed.id}
                    sx={{
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      pb: 2,
                      '&:last-of-type': { borderBottom: 'none', pb: 0 },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                      <Button
                        href={`/w/${workspaceId}/seeds/${seed.id}`}
                        component={Link}
                        variant="text"
                        sx={{ p: 0, minWidth: 0, fontWeight: 600 }}
                      >
                        {seed.title}
                      </Button>
                      <Typography variant="caption" color="text.secondary">
                        {seed.status}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {seed.summary || seed.why_it_matters || 'No summary yet'}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        {showIdeaBuilder && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Idea builder
              </Typography>
              <CopilotPanel
                workspaceId={workspaceId}
                allowSeedCreation
                lensDefault="explore"
                modeDefault="ask"
                onSeedCreated={handleSeedCreated}
              />
            </CardContent>
          </Card>
        )}
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
      seeds: seeds.slice(0, 5),
    },
  };
});

export default WorkspaceDashboard;


