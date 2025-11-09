import type { WorkspaceWithRole } from './workspaces';

export type WorkspaceSelectionResult =
  | { workspaceId: string; reason: 'last_workspace_cookie' | 'first_available' }
  | { workspaceId: null; reason: 'none_available' };

export const selectWorkspaceFallback = (
  workspaces: WorkspaceWithRole[],
  lastWorkspaceId?: string | null,
): WorkspaceSelectionResult => {
  if (!workspaces.length) {
    return { workspaceId: null, reason: 'none_available' };
  }

  if (lastWorkspaceId) {
    const match = workspaces.find((workspace) => workspace.id === lastWorkspaceId);
    if (match) {
      return { workspaceId: match.id, reason: 'last_workspace_cookie' };
    }
  }

  return { workspaceId: workspaces[0].id, reason: 'first_available' };
};
