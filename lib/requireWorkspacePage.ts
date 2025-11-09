import type { GetServerSidePropsContext, GetServerSidePropsResult } from 'next';
import { createSupabaseServerClient, getSupabaseServiceRoleClient } from './supabaseServer';
import { getUserWorkspaces } from './workspaces';
import type { WorkspaceWithRole } from './workspaces';
import type { Workspace } from '../types/db';

type WorkspacePageProps = {
  initialUser: unknown;
  initialSession: unknown;
  workspaces: WorkspaceWithRole[];
  workspace: WorkspaceWithRole;
  workspaceId: string;
};

export async function requireAuthAndWorkspace(
  ctx: GetServerSidePropsContext,
): Promise<GetServerSidePropsResult<WorkspacePageProps>> {
  const supabase = createSupabaseServerClient(ctx.req as any, ctx.res as any);
  const [
    {
      data: { user },
      error: userError,
    },
    {
      data: { session },
    },
  ] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);

  if (userError || !user) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[requireAuthAndWorkspace] Missing user, redirecting to login');
    }
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  const workspaceId = ctx.params?.workspaceId;

  if (!workspaceId || Array.isArray(workspaceId)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[requireAuthAndWorkspace] Missing workspaceId in route params');
    }
    return {
      redirect: {
        destination: '/app',
        permanent: false,
      },
    };
  }

  const supabaseAdmin = getSupabaseServiceRoleClient();

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('workspace_members')
    .select(
      `
      role,
      workspaces:workspaces (
        id,
        name,
        created_by,
        created_at
      )
    `,
    )
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipError || !membership?.workspaces) {
    console.warn('[requireAuthAndWorkspace] Membership not found', {
      workspaceId,
      userId: user.id,
      membershipError,
    });
    return {
      notFound: true,
    };
  }

  const workspaceRecord = membership.workspaces as unknown as Workspace;
  const workspace = {
    ...workspaceRecord,
    role: membership.role,
  } as WorkspaceWithRole;

  const workspaces = await getUserWorkspaces(supabaseAdmin, user.id);
  if (process.env.NODE_ENV !== 'production') {
    console.log('[requireAuthAndWorkspace] Loaded workspace context', {
      workspaceId,
      total: workspaces.length,
    });
  }

  return {
    props: {
      initialUser: user,
      initialSession: session ?? null,
      workspaces,
      workspace,
      workspaceId,
    },
  };
}
