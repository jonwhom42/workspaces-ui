import * as React from 'react';
import { useRouter } from 'next/router';
import supabase from '../../lib/supabaseClient';
import type { WorkspaceWithRole } from '../../lib/workspaces';
import { LAST_WORKSPACE_COOKIE } from '../../lib/workspaces';
import type { Workspace } from '../../types/db';
import { useAuth } from './AuthContext';

type WorkspaceContextValue = {
  workspaces: WorkspaceWithRole[];
  currentWorkspace: WorkspaceWithRole | null;
  loading: boolean;
  selectWorkspace: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<WorkspaceWithRole[]>;
};

const WorkspaceContext = React.createContext<WorkspaceContextValue>({
  workspaces: [],
  currentWorkspace: null,
  loading: false,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  selectWorkspace: () => {},
  refreshWorkspaces: async () => [],
});

type WorkspaceProviderProps = {
  initialWorkspaces?: WorkspaceWithRole[];
  initialWorkspaceId?: string | null;
  children: React.ReactNode;
};

const setLastWorkspaceCookie = (workspaceId: string) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${LAST_WORKSPACE_COOKIE}=${workspaceId}; path=/; SameSite=Lax`;
};

export function WorkspaceProvider({
  initialWorkspaces = [],
  initialWorkspaceId = null,
  children,
}: WorkspaceProviderProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = React.useState<WorkspaceWithRole[]>(initialWorkspaces);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setWorkspaces(initialWorkspaces);
  }, [initialWorkspaces]);

  const workspaceIdFromRoute = router.query.workspaceId;
  const effectiveWorkspaceId =
    (typeof workspaceIdFromRoute === 'string'
      ? workspaceIdFromRoute
      : initialWorkspaceId ?? null) || null;

  const currentWorkspace =
    workspaces.find((workspace) => workspace.id === effectiveWorkspaceId) ?? null;

  const refreshWorkspaces = React.useCallback(async () => {
    if (!user?.id) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[WorkspaceContext] refreshWorkspaces aborted (no user)');
      }
      setWorkspaces([]);
      return [];
    }
    setLoading(true);
    const { data, error } = await supabase
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
      .eq('user_id', user.id)
      .order('created_at', { referencedTable: 'workspaces', ascending: true });

    let list: WorkspaceWithRole[] = [];

    if (process.env.NODE_ENV !== 'production') {
      console.log('[WorkspaceContext] refreshWorkspaces response', {
        entries: data?.length ?? 0,
        error,
      });
    }

    if (!error && data) {
      list = data.map((entry) => {
        const workspace = entry.workspaces as unknown as Workspace;
        return {
          ...workspace,
          role: entry.role,
        };
      });
      setWorkspaces(list);
    }
    setLoading(false);
    return list;
  }, [user?.id]);

  React.useEffect(() => {
    if (!user) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[WorkspaceContext] clearing workspaces (no user)');
      }
      setWorkspaces([]);
      return;
    }
    if (initialWorkspaces.length === 0) {
      refreshWorkspaces();
    }
  }, [user, initialWorkspaces.length, refreshWorkspaces]);

  const selectWorkspace = React.useCallback(
    (workspaceId: string) => {
      if (!workspaceId) return;
      setLastWorkspaceCookie(workspaceId);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[WorkspaceContext] navigating to workspace', workspaceId);
      }
      const targetPath = `/w/${workspaceId}/dashboard`;
      if (router.asPath.startsWith(`/w/${workspaceId}`)) {
        router.replace(targetPath);
      } else {
        router.push(targetPath);
      }
    },
    [router],
  );

  React.useEffect(() => {
    if (!workspaces.length || currentWorkspace) {
      return;
    }
    selectWorkspace(workspaces[0].id);
  }, [workspaces, currentWorkspace, selectWorkspace]);

  const value = React.useMemo(
    () => ({
      workspaces,
      currentWorkspace,
      loading,
      selectWorkspace,
      refreshWorkspaces,
    }),
    [workspaces, currentWorkspace, loading, selectWorkspace, refreshWorkspaces],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export const useWorkspace = () => React.useContext(WorkspaceContext);
