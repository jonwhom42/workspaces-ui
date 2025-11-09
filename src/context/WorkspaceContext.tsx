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
  setWorkspace: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<WorkspaceWithRole[]>;
};

const WorkspaceContext = React.createContext<WorkspaceContextValue>({
  workspaces: [],
  currentWorkspace: null,
  loading: false,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setWorkspace: () => {},
  refreshWorkspaces: async () => [],
});

type WorkspaceProviderProps = {
  initialWorkspaces?: WorkspaceWithRole[];
  initialWorkspace?: WorkspaceWithRole | null;
  children: React.ReactNode;
};

const setLastWorkspaceCookie = (workspaceId: string) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${LAST_WORKSPACE_COOKIE}=${workspaceId}; path=/; SameSite=Lax`;
};

/**
 * WorkspaceProvider reflects server-provided membership data. It never mutates workspace_members
 * and only revalidates membership through Supabase queries that stay within RLS constraints.
 */
export function WorkspaceProvider({
  initialWorkspaces = [],
  initialWorkspace = null,
  children,
}: WorkspaceProviderProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = React.useState<WorkspaceWithRole[]>(initialWorkspaces);
  const [loading, setLoading] = React.useState(false);
  const [currentWorkspace, setCurrentWorkspace] = React.useState<WorkspaceWithRole | null>(
    initialWorkspace,
  );

  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[WorkspaceContext] hydrating from SSR', {
        workspaces: initialWorkspaces.length,
        initialWorkspaceId: initialWorkspace?.id ?? null,
      });
    }
    setWorkspaces(initialWorkspaces);
  }, [initialWorkspaces, initialWorkspace?.id, initialWorkspace]);

  React.useEffect(() => {
    setCurrentWorkspace(initialWorkspace ?? null);
  }, [initialWorkspace?.id, initialWorkspace]);

  const refreshWorkspaces = React.useCallback(async () => {
    if (!user?.id) {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[WorkspaceContext] refreshWorkspaces aborted (no user)');
      }
      setWorkspaces([]);
      return [];
    }
    setLoading(true);
    // RLS ensures this query only returns workspaces the user is already a member of.
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
      console.info('[WorkspaceContext] refreshWorkspaces response', {
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
      setCurrentWorkspace((prev) => {
        if (prev && list.some((workspace) => workspace.id === prev.id)) {
          return prev;
        }
        return list[0] ?? null;
      });
    }
    setLoading(false);
    return list;
  }, [user?.id]);

  React.useEffect(() => {
    if (!user) {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[WorkspaceContext] clearing workspaces (no user)');
      }
      setWorkspaces([]);
      return;
    }
    if (initialWorkspaces.length === 0) {
      refreshWorkspaces();
    }
  }, [user, initialWorkspaces.length, refreshWorkspaces]);

  const setWorkspace = React.useCallback(
    (workspaceId: string) => {
      if (!workspaceId) return;
      setLastWorkspaceCookie(workspaceId);
      if (process.env.NODE_ENV !== 'production') {
        console.info('[WorkspaceContext] navigating to workspace', workspaceId);
      }
       // Navigation-only: server-side guards + RLS still validate membership on the destination page.
      setCurrentWorkspace((prev) => {
        if (prev?.id === workspaceId) {
          return prev;
        }
        const match = workspaces.find((workspace) => workspace.id === workspaceId);
        return match ?? prev;
      });

      const targetPath = `/w/${workspaceId}/dashboard`;
      if (router.asPath.startsWith(`/w/${workspaceId}`)) {
        router.replace(targetPath);
      } else {
        router.push(targetPath);
      }
    },
    [router, workspaces],
  );

  const value = React.useMemo(
    () => ({
      workspaces,
      currentWorkspace,
      loading,
      setWorkspace,
      refreshWorkspaces,
    }),
    [workspaces, currentWorkspace, loading, setWorkspace, refreshWorkspaces],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export const useWorkspace = () => React.useContext(WorkspaceContext);
