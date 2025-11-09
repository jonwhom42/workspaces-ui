import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import GoogleIcon from '@mui/icons-material/Google';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import supabase from '../lib/supabaseClient';
import { useRouter } from 'next/router';

const persistSession = async (session) => {
  if (!session?.access_token || !session?.refresh_token) {
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[login] Persisting Supabase session');
  }

  const response = await fetch('/api/auth/set-cookie', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Unable to persist session.');
  }
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState('signin');
  const [formState, setFormState] = React.useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [alert, setAlert] = React.useState(null);

  React.useEffect(() => {
    let isMounted = true;
    const syncSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session && isMounted) {
        try {
          await persistSession(session);
          router.replace('/app');
        } catch (error) {
          console.error('Persist session failed', error);
        }
      }
    };
    syncSession();
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        try {
          await persistSession(session);
          router.replace('/app');
        } catch (error) {
          console.error('Persist session failed', error);
        }
      }
    });
    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router]);

  const handleChange = (event, newValue) => {
    setMode(newValue);
    setAlert(null);
  };

  const handleInputChange = (event) => {
    setFormState((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setAlert(null);
    try {
      if (mode === 'signup') {
        if (formState.password !== formState.confirmPassword) {
          setAlert({ type: 'error', message: 'Passwords must match.' });
          setSubmitting(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: formState.email,
          password: formState.password,
        });
        if (error) {
          throw error;
        }
        if (data.session) {
          await persistSession(data.session);
          router.push('/app');
          return;
        }
        setAlert({
          type: 'success',
          message: 'Check your email to confirm your account before signing in.',
        });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formState.email,
          password: formState.password,
        });
        if (error) {
          throw error;
        }
        await persistSession(data.session);
        router.push('/app');
      }
    } catch (error) {
      setAlert({ type: 'error', message: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setAlert(null);
    try {
      const redirectTo = `${window.location.origin}/login`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });
      if (error) {
        throw error;
      }
    } catch (error) {
      setAlert({ type: 'error', message: error.message });
      setSubmitting(false);
    }
  };

  return (
    <Container component="main" maxWidth="sm" sx={{ py: 8 }}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 6 } }}>
        <Stack spacing={3}>
          <Stack alignItems="center" spacing={1}>
            <Avatar sx={{ bgcolor: 'secondary.main' }}>
              <LockOutlinedIcon />
            </Avatar>
            <Typography component="h1" variant="h5">
              {mode === 'signin' ? 'Sign in' : 'Create an account'}
            </Typography>
          </Stack>

          <Tabs value={mode} onChange={handleChange} centered>
            <Tab value="signin" label="Sign In" />
            <Tab value="signup" label="Sign Up" />
          </Tabs>

          {alert && <Alert severity={alert.type}>{alert.message}</Alert>}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <Stack spacing={2}>
              <TextField
                label="Email address"
                name="email"
                fullWidth
                required
                autoComplete="email"
                value={formState.email}
                onChange={handleInputChange}
              />
              <TextField
                label="Password"
                name="password"
                type="password"
                fullWidth
                required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={formState.password}
                onChange={handleInputChange}
              />
              {mode === 'signup' && (
                <TextField
                  label="Confirm password"
                  name="confirmPassword"
                  type="password"
                  fullWidth
                  required
                  value={formState.confirmPassword}
                  onChange={handleInputChange}
                />
              )}
              <Button type="submit" variant="contained" disabled={submitting}>
                {submitting ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={20} color="inherit" />
                    <span>{mode === 'signin' ? 'Signing in...' : 'Creating account...'}</span>
                  </Stack>
                ) : (
                  <span>{mode === 'signin' ? 'Sign In' : 'Sign Up'}</span>
                )}
              </Button>
              <Button
                variant="outlined"
                startIcon={<GoogleIcon />}
                onClick={handleGoogleSignIn}
                disabled={submitting}
              >
                Continue with Google
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
}
