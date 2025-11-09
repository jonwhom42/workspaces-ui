import * as React from 'react';
import { useRouter } from 'next/router';
import type { Session } from '@supabase/supabase-js';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import GoogleIcon from '@mui/icons-material/Google';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import supabase from '../../../lib/supabaseClient';

type AuthMode = 'signin' | 'signup';

type AuthViewProps = {
  initialMode: AuthMode;
};

type FormState = {
  email: string;
  password: string;
  confirmPassword: string;
};

const persistSession = async (session: Session | null) => {
  if (!session?.access_token || !session?.refresh_token) {
    return;
  }

  const response = await fetch('/api/auth/set-cookie', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
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

const sanitizeRedirect = (value: string | null): string => {
  if (!value || !value.startsWith('/')) {
    return '/app';
  }
  return value;
};

const AuthView: React.FC<AuthViewProps> = ({ initialMode }) => {
  const router = useRouter();
  const redirectParam = typeof router.query.redirectTo === 'string' ? router.query.redirectTo : null;
  const redirectDestination = React.useMemo(
    () => sanitizeRedirect(redirectParam),
    [redirectParam],
  );
  const [mode, setMode] = React.useState<AuthMode>(initialMode);
  const [formState, setFormState] = React.useState<FormState>({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [alert, setAlert] = React.useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  React.useEffect(() => {
    setMode(initialMode);
    setAlert(null);
  }, [initialMode]);

  React.useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted || !session) {
        return;
      }

      await persistSession(session);
      router.replace(redirectDestination);
    };

    syncSession();
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted || !session) {
        return;
      }
      await persistSession(session);
      router.replace(redirectDestination);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [redirectDestination, router]);

  const handleTabChange = (_event: React.SyntheticEvent<Element, Event>, nextMode: AuthMode) => {
    setMode(nextMode);
    setAlert(null);

    const pathname = nextMode === 'signin' ? '/auth/sign-in' : '/auth/sign-up';
    const query = redirectParam ? `?redirectTo=${encodeURIComponent(redirectParam)}` : '';

    router.replace(`${pathname}${query}`, undefined, { shallow: true });
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
          router.replace(redirectDestination);
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
        router.replace(redirectDestination);
      }
    } catch (submissionError) {
      const message =
        submissionError instanceof Error ? submissionError.message : 'Authentication failed.';
      setAlert({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setAlert(null);
    try {
      const redirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}${router.asPath}` : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: redirectTo ? { redirectTo } : undefined,
      });
      if (error) {
        throw error;
      }
    } catch (submissionError) {
      const message =
        submissionError instanceof Error ? submissionError.message : 'Unable to start Google sign in.';
      setAlert({ type: 'error', message });
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

          <Tabs value={mode} onChange={handleTabChange} centered>
            <Tab value="signin" label="Sign In" />
            <Tab value="signup" label="Sign Up" />
          </Tabs>

          {alert && <Alert severity={alert.type}>{alert.message}</Alert>}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <Stack spacing={2}>
              <TextField
                label="Email address"
                name="email"
                type="email"
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
};

export default AuthView;
