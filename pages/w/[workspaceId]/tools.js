import * as React from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { requireAuthAndWorkspace } from '../../../lib/requireWorkspacePage';

const tools = [
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
];

export default function WorkspaceTools({ workspace }) {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Typography variant="overline" color="text.secondary">
          {workspace.name}
        </Typography>
        <Typography variant="h4">Tools</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
          Swap these starter cards with the utilities your team builds. Each card is ready to host an
          entry point, description, or quick actions.
        </Typography>
      </Stack>

      <Grid container spacing={3}>
        {tools.map((tool) => (
          <Grid item xs={12} md={6} key={tool.name}>
            <Card
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
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

export const getServerSideProps = requireAuthAndWorkspace;
