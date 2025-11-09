import type { GetServerSideProps } from 'next';
import { parse, serialize } from 'cookie';
import { withAuth } from '../../lib/authGuard';
import {
  createWorkspaceWithOwner,
  getUserWorkspaces,
  LAST_WORKSPACE_COOKIE,
} from '../../lib/workspaces';
import { selectWorkspaceFallback } from '../../lib/workspaceRouting';
import { getSupabaseServiceRoleClient } from '../../lib/supabaseServer';

const AppIndex = () => null;

export const getServerSideProps: GetServerSideProps = withAuth(async (ctx) => {
  const { supabase, user, req, res } = ctx;
  const serviceRole = getSupabaseServiceRoleClient();
  let workspaces = await getUserWorkspaces(supabase, user.id, {
    fallbackClient: serviceRole,
  });

  console.info('[pages/app] fetched workspaces', {
    userId: user.id,
    total: workspaces.length,
  });

  if (workspaces.length === 0) {
    console.info('[pages/app] provisioning default workspace', { userId: user.id });
    const defaultName = user.user_metadata?.full_name
      ? `${user.user_metadata.full_name}'s Workspace`
      : `${user.email?.split('@')[0] ?? 'My'} Workspace`;
    await createWorkspaceWithOwner(serviceRole, user.id, defaultName);
    workspaces = await getUserWorkspaces(supabase, user.id, {
      fallbackClient: serviceRole,
    });
    console.info('[pages/app] workspace provisioning complete', {
      userId: user.id,
      total: workspaces.length,
    });
    if (workspaces.length === 0) {
      throw new Error('Workspace provisioning failed for authenticated user');
    }
  }

  const cookies = parse(req.headers.cookie ?? '');
  const selection = selectWorkspaceFallback(workspaces, cookies[LAST_WORKSPACE_COOKIE]);

  if (!selection.workspaceId) {
    throw new Error('Workspace selection failed despite provisioning');
  }

  res.setHeader(
    'Set-Cookie',
    serialize(LAST_WORKSPACE_COOKIE, selection.workspaceId, {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
    }),
  );

  console.info('[pages/app] redirecting user to workspace', {
    userId: user.id,
    workspaceId: selection.workspaceId,
    reason: selection.reason,
  });

  return {
    redirect: {
      destination: `/w/${selection.workspaceId}/dashboard`,
      permanent: false,
    },
  };
});

export default AppIndex;
