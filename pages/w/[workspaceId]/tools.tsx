import * as React from 'react';
import type { NextPage } from 'next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { withAuth } from '../../../lib/authGuard';
import { getWorkspaceContext, type WorkspaceWithRole } from '../../../lib/workspaces';
import { getSupabaseServiceRoleClient } from '../../../lib/supabaseServer';

const TOOLS = [
  {
    name: 'Data Explorer',
    description: 'Inspect new observations, flag anomalies, and annotate what needs deeper review.',
  },
  {
    name: 'Signal Builder',
    description: 'Prototype automated checks or metrics to keep your dashboards fed with context.',
  },
  {
    name: 'Report Composer',
    description: 'Assemble updates for stakeholders by stitching together widgets and commentary.',
  },
  {
    name: 'Integration Hub',
    description: 'Connect outbound webhooks, shared drives, or other systems of record.',
  },
] as const;

type WorkspaceToolsProps = {
  workspace: WorkspaceWithRole;
  workspaces: WorkspaceWithRole[];
};

const WorkspaceTools: NextPage<WorkspaceToolsProps> = ({ workspace }) => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Typography variant="overline" color="text.secondary">
          {workspace.name}
        </Typography>
        <Typography variant="h4">Tools</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
          Swap these starter cards with the utilities your team builds. Each card is ready to host
          an entry point, description, or quick actions.
        </Typography>
      </Stack>

      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }}
        gap={3}
        alignItems="stretch"
      >
        {TOOLS.map((tool) => (
          <Card
            key={tool.name}
            variant="outlined"
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <CardHeader title={tool.name} />
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography color="text.secondary">{tool.description}</Typography>
            </CardContent>
            <CardActions sx={{ px: 3, pb: 3, pt: 0 }}>
              <Button variant="contained">Open</Button>
            </CardActions>
          </Card>
        ))}
      </Box>
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

  console.info('[pages/w/tools] workspace lookup', {
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

export default WorkspaceTools;
