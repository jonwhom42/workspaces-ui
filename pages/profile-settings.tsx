import * as React from 'react';
import type { NextPage } from 'next';
import type { User } from '@supabase/supabase-js';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import supabase from '../lib/supabaseClient';
import { withAuth } from '../lib/authGuard';

type AlertState = {
  type: 'success' | 'error';
  message: string;
};

type ProfileSettingsProps = {
  user: User;
};

const ProfileSettings: NextPage<ProfileSettingsProps> = ({ user }) => {
  const [formState, setFormState] = React.useState({
    fullName: (user.user_metadata?.full_name as string | undefined) || '',
    email: user.email ?? '',
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [alert, setAlert] = React.useState<AlertState | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setAlert(null);
    try {
      const { error } = await supabase.auth.updateUser({
        email: formState.email,
        data: { full_name: formState.fullName },
      });

      if (error) {
        throw error;
      }

      setAlert({ type: 'success', message: 'Profile updated successfully.' });
    } catch (submissionError) {
      const message =
        submissionError instanceof Error ? submissionError.message : 'Unable to update profile.';
      setAlert({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 } }}>
        <Stack spacing={3} component="form" onSubmit={handleSubmit}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ width: 64, height: 64 }}>
              {(formState.fullName || formState.email || 'U').slice(0, 1).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h5">Profile settings</Typography>
              <Typography color="text.secondary">Update how teammates see you.</Typography>
            </Box>
          </Stack>

          {alert && <Alert severity={alert.type}>{alert.message}</Alert>}

          <TextField
            name="fullName"
            label="Full name"
            value={formState.fullName}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            name="email"
            label="Email address"
            type="email"
            value={formState.email}
            onChange={handleChange}
            fullWidth
            required
          />
          <Box display="flex" justifyContent="flex-end" gap={2}>
            <Button
              variant="outlined"
              onClick={() =>
                setFormState({
                  fullName: (user.user_metadata?.full_name as string | undefined) || '',
                  email: user.email ?? '',
                })
              }
            >
              Reset
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save changes'}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
};

export const getServerSideProps = withAuth(async ({ user }) => {
  return {
    props: {
      user,
    },
  };
});

export default ProfileSettings;
