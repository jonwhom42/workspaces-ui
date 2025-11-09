import * as React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { requireAuthAndWorkspace } from '../../../lib/requireWorkspacePage';

export default function WorkspaceDashboard({ workspace }) {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Typography variant="overline" color="text.secondary">
          {workspace.name}
        </Typography>
        <Typography variant="h4">Dashboard</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
          Wire up your primary metrics, charts, and narratives to keep the entire team aligned.
          The cards below are placeholders scoped to this workspace.
        </Typography>
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
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
        </Grid>
        <Grid item xs={12} md={4}>
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
        </Grid>
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardHeader title="Upcoming Deliverables" />
            <CardContent>
              <Typography color="text.secondary">
                Reserve this space for timelines, schedules, or kanban views that keep delivery on track.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}

export const getServerSideProps = requireAuthAndWorkspace;
