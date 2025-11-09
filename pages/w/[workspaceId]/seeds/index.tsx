import * as React from 'react';
import type { NextPage } from 'next';
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { withAuth } from '../../../../lib/authGuard';
import { getWorkspaceContext } from '../../../../lib/workspaces';
import { getSeedsForWorkspace } from '../../../../lib/seeds';
import { getSupabaseServiceRoleClient } from '../../../../lib/supabaseServer';
import type { WorkspaceWithRole } from '../../../../lib/workspaces';
import type { Seed } from '../../../../types/db';
import Link from 'next/link';
import { useRouter } from 'next/router';

type SeedsPageProps = {
  workspace: WorkspaceWithRole;
  workspaces: WorkspaceWithRole[];
  seeds: Seed[];
};

const SeedsPage: NextPage<SeedsPageProps> = ({ workspace, workspaces, seeds }) => {
  const router = useRouter();
  const workspaceId = workspace.id;
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [formState, setFormState] = React.useState({
    title: '',
    summary: '',
    whyItMatters: '',
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/seeds/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          title: formState.title,
          summary: formState.summary,
          whyItMatters: formState.whyItMatters,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to create seed');
      }
      const payload = await response.json();
      router.push(`/w/${workspaceId}/seeds/${payload.seed.id}`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" mb={4}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            {workspace.name}
          </Typography>
          <Typography variant="h4">Seeds</Typography>
          <Typography color="text.secondary">
            Capture the core ideas your workspace is nurturing. Everything else links back to these.
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setDialogOpen(true)}>
          New Seed
        </Button>
      </Stack>

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
            Start by defining the core idea you want this workspace to explore.
          </Typography>
          <Button sx={{ mt: 2 }} variant="outlined" onClick={() => setDialogOpen(true)}>
            Create your first seed
          </Button>
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New Seed</DialogTitle>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              pt: 0,
            }}
          >
            <TextField
              label="Title"
              value={formState.title}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, title: event.target.value }))
              }
              required
              fullWidth
            />
            <TextField
              label="Summary"
              value={formState.summary}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, summary: event.target.value }))
              }
              multiline
              minRows={2}
            />
            <TextField
              label="Why it matters"
              value={formState.whyItMatters}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, whyItMatters: event.target.value }))
              }
              multiline
              minRows={3}
            />
            {error && (
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Seed'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
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
