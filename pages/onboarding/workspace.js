import * as React from 'react';
import { useRouter } from 'next/router';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { createSupabaseServerClient, getSupabaseServiceRoleClient } from '../../lib/supabaseServer';
import { getUserWorkspaces } from '../../lib/workspaces';

export default function WorkspaceOnboarding({ suggestedName }) {
  const router = useRouter();
  const [name, setName] = React.useState(suggestedName);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Workspace name is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/workspaces/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
        credentials: 'include',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to create workspace.');
      }
      const payload = await response.json();
      router.replace(`/w/${payload.workspace.id}/dashboard`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 } }}>
        <Stack spacing={3} component="form" onSubmit={handleSubmit}>
          <div>
            <Typography variant="overline" color="text.secondary">
              Getting started
            </Typography>
            <Typography variant="h4">Create your first workspace</Typography>
            <Typography color="text.secondary">
              Workspaces keep dashboards, automations, and agents scoped to the right team.
            </Typography>
          </div>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Workspace name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            required
          />
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Creating workspace...' : 'Create workspace'}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

export async function getServerSideProps({ req, res }) {
  const supabase = createSupabaseServerClient(req, res);
  const [
    {
      data: { user },
      error,
    },
    {
      data: { session },
    },
  ] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);

  if (error || !user) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  const supabaseAdmin = getSupabaseServiceRoleClient();
  const workspaces = await getUserWorkspaces(supabaseAdmin, user.id);

  if (process.env.NODE_ENV !== 'production') {
    console.log('[onboarding/workspace] Existing workspace count', workspaces.length);
  }

  if (workspaces.length) {
    return {
      redirect: {
        destination: '/app',
        permanent: false,
      },
    };
  }

  const suggestedName = user.user_metadata?.full_name
    ? `${user.user_metadata.full_name}'s Workspace`
    : `${user.email?.split('@')[0] ?? 'My'}'s Workspace`;

  return {
    props: {
      initialSession: session ?? null,
      initialUser: user,
      suggestedName,
    },
  };
}
