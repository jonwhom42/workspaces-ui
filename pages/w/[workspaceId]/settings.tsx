import * as React from 'react';
import type { NextPage } from 'next';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { withAuth } from '../../../lib/authGuard';
import { getWorkspaceContext, type WorkspaceWithRole } from '../../../lib/workspaces';
import { getSupabaseServiceRoleClient } from '../../../lib/supabaseServer';

type WorkspaceSettingsProps = {
  workspace: WorkspaceWithRole;
  workspaces: WorkspaceWithRole[];
};

const WorkspaceSettings: NextPage<WorkspaceSettingsProps> = ({ workspace }) => (
  <Container maxWidth="md" sx={{ py: 4 }}>
    <Stack spacing={1} sx={{ mb: 4 }}>
      <Typography variant="overline" color="text.secondary">
        Workspace settings
      </Typography>
      <Typography variant="h4">{workspace.name}</Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 540 }}>
        Use this page to review metadata and share insight with teammates. Additional controls will
        appear automatically as features are enabled.
      </Typography>
    </Stack>
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Typography variant="h6">Workspace details</Typography>
      <Stack spacing={0.5}>
        <Typography variant="body2" color="text.secondary">
          Name
        </Typography>
        <Typography>{workspace.name}</Typography>
      </Stack>
      <Stack spacing={0.5}>
        <Typography variant="body2" color="text.secondary">
          Workspace ID
        </Typography>
        <Typography sx={{ fontFamily: 'monospace' }}>{workspace.id}</Typography>
      </Stack>
      <Stack spacing={0.5}>
        <Typography variant="body2" color="text.secondary">
          Created
        </Typography>
        <Typography>{new Date(workspace.created_at).toLocaleString()}</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Need to rename or transfer ownership? Reach out to the workspace owner — full controls will
        ship soon.
      </Typography>
    </Paper>
  </Container>
);

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

  console.info('[pages/w/settings] workspace lookup', {
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

export default WorkspaceSettings;
