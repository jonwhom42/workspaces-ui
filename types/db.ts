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

export type SeedStatus = 'germinating' | 'growing' | 'paused' | 'archived';

export type Seed = {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  summary: string | null;
  why_it_matters: string | null;
  status: SeedStatus;
  created_at: string;
  updated_at: string;
};

export type KnowledgeItemType = 'note' | 'url' | 'file' | 'transcript' | 'system';

export type KnowledgeItem = {
  id: string;
  workspace_id: string;
  seed_id: string | null;
  created_by: string;
  type: string;
  title: string | null;
  content: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ExperimentStatus = 'planned' | 'running' | 'completed' | 'cancelled';

export type Experiment = {
  id: string;
  workspace_id: string;
  seed_id: string;
  created_by: string;
  title: string;
  hypothesis: string | null;
  plan: string | null;
  status: ExperimentStatus;
  result_summary: string | null;
  impact: number | null;
  created_at: string;
  updated_at: string;
};

export type Principle = {
  id: string;
  workspace_id: string;
  seed_id: string | null;
  created_by: string;
  statement: string;
  category: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Insight = {
  id: string;
  workspace_id: string;
  seed_id: string | null;
  created_by: string;
  source_type: string | null;
  source_id: string | null;
  summary: string;
  details: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceEvent = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  seed_id: string | null;
  type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};
