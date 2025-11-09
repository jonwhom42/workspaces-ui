import * as React from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { AppCacheProvider } from '@mui/material-nextjs/v15-pagesRouter';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import type { Session, User } from '@supabase/supabase-js';
import theme from '../src/theme';
import MiniDrawer from '../src/components/MiniDrawer';
import { AuthProvider } from '../src/context/AuthContext';
import { WorkspaceProvider } from '../src/context/WorkspaceContext';
import type { WorkspaceWithRole } from '../lib/workspaces';

type ExtendedPageProps = {
  initialSession?: Session | null;
  initialUser?: User | null;
  workspaces?: WorkspaceWithRole[];
  currentWorkspace?: WorkspaceWithRole | null;
} & AppProps['pageProps'];

type ExtendedAppProps = Omit<AppProps<ExtendedPageProps>, 'pageProps'> & {
  pageProps: ExtendedPageProps;
};

export default function MyApp(props: ExtendedAppProps) {
  const { Component, pageProps, router } = props;
  const {
    initialSession = null,
    initialUser = null,
    workspaces = [],
    currentWorkspace = null,
  } = pageProps;
  const isWorkspaceRoute = router.pathname.startsWith('/w/');

  const workspaceShell = isWorkspaceRoute ? (
    <WorkspaceProvider
      initialWorkspaces={workspaces}
      initialWorkspace={currentWorkspace}
    >
      <MiniDrawer>
        <Component {...pageProps} />
      </MiniDrawer>
    </WorkspaceProvider>
  ) : (
    <Component {...pageProps} />
  );

  return (
    <AppCacheProvider {...props}>
      <Head>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
      </Head>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider initialSession={initialSession} initialUser={initialUser}>
          {workspaceShell}
        </AuthProvider>
      </ThemeProvider>
    </AppCacheProvider>
  );
}
