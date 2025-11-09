import { parse } from 'cookie';
import { serialize } from 'cookie';
import { createSupabaseServerClient, getSupabaseServiceRoleClient } from '../lib/supabaseServer';
import { getUserWorkspaces, LAST_WORKSPACE_COOKIE } from '../lib/workspaces';

export default function AppRedirect() {
  return null;
}

export async function getServerSideProps({ req, res }) {
  const supabase = createSupabaseServerClient(req, res);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

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
    console.log('[pages/app] User workspaces', {
      userId: user.id,
      count: workspaces.length,
    });
  }

  if (!workspaces.length) {
    return {
      redirect: {
        destination: '/onboarding/workspace',
        permanent: false,
      },
    };
  }

  const cookies = parse(req.headers.cookie ?? '');
  const lastWorkspaceId = cookies[LAST_WORKSPACE_COOKIE];
  const fallbackWorkspaceId =
    lastWorkspaceId && workspaces.some((workspace) => workspace.id === lastWorkspaceId)
      ? lastWorkspaceId
      : workspaces[0].id;

  res.setHeader(
    'Set-Cookie',
    serialize(LAST_WORKSPACE_COOKIE, fallbackWorkspaceId, {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
    }),
  );

  return {
    redirect: {
      destination: `/w/${fallbackWorkspaceId}/dashboard`,
      permanent: false,
    },
  };
}
