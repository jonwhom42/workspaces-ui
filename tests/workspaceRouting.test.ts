import { describe, it, expect } from 'vitest';
import { selectWorkspaceFallback } from '../lib/workspaceRouting';
import type { WorkspaceWithRole } from '../lib/workspaces';

const mockWorkspace = (id: string): WorkspaceWithRole => ({
  id,
  name: `Workspace ${id}`,
  created_at: new Date().toISOString(),
  created_by: 'user-123',
  role: 'owner',
});

describe('selectWorkspaceFallback', () => {
  it('returns none when there are no workspaces', () => {
    const result = selectWorkspaceFallback([], null);
    expect(result).toEqual({ workspaceId: null, reason: 'none_available' });
  });

  it('prefers last workspace cookie when valid', () => {
    const list = [mockWorkspace('a'), mockWorkspace('b')];
    const result = selectWorkspaceFallback(list, 'b');
    expect(result).toEqual({ workspaceId: 'b', reason: 'last_workspace_cookie' });
  });

  it('falls back to first workspace when cookie is stale', () => {
    const list = [mockWorkspace('a'), mockWorkspace('b')];
    const result = selectWorkspaceFallback(list, 'missing');
    expect(result).toEqual({ workspaceId: 'a', reason: 'first_available' });
  });
});
