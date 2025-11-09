export type Workspace = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

export type WorkspaceMemberRole = 'owner' | 'admin' | 'member';

export type WorkspaceMember = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceMemberRole;
  created_at: string;
};

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};
