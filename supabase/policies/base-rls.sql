-- Base multi-tenant RLS contract for Supabase.
-- Run these statements in the Supabase SQL editor (or migrations) before deploying new features.

begin;

--------------------------------------------------------------------------------
-- Helper functions to evaluate workspace membership without recursion.
--------------------------------------------------------------------------------
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
  );
end;
$$;

create or replace function public.is_workspace_admin(p_workspace_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  );
end;
$$;

--------------------------------------------------------------------------------
-- workspaces: users can only see workspaces they explicitly belong to.
--------------------------------------------------------------------------------
alter table public.workspaces enable row level security;

create policy workspaces_select_members
  on public.workspaces
  for select
  using (
    public.is_workspace_member(workspaces.id)
  );

--------------------------------------------------------------------------------
-- workspace_members: scoped visibility per member + elevated visibility for owners/admins.
--------------------------------------------------------------------------------
alter table public.workspace_members enable row level security;

create policy workspace_members_self
  on public.workspace_members
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy workspace_members_admin_read
  on public.workspace_members
  for select
  using (public.is_workspace_admin(workspace_members.workspace_id));

--------------------------------------------------------------------------------
-- Template for any workspace-bound table (replace `example_table` + columns as needed).
-- Every table MUST include a workspace_id column and leverage this pattern.
--------------------------------------------------------------------------------
-- alter table public.example_table enable row level security;
-- create policy example_table_enforce_membership
--   on public.example_table
--   for all
--   using (
--     exists (
--       select 1
--       from public.workspace_members wm
--       where wm.workspace_id = example_table.workspace_id
--         and wm.user_id = auth.uid()
--     )
--   )
--   with check (
--     exists (
--       select 1
--       from public.workspace_members wm
--       where wm.workspace_id = example_table.workspace_id
--         and wm.user_id = auth.uid()
--     )
--   );

--------------------------------------------------------------------------------
-- Seeds & knowledge model tables – enforce workspace membership for all actions.
--------------------------------------------------------------------------------

alter table public.seeds enable row level security;
create policy seeds_enforce_membership
  on public.seeds
  for all
  using (
    public.is_workspace_member(seeds.workspace_id)
  )
  with check (
    public.is_workspace_member(seeds.workspace_id)
  );

alter table public.knowledge_items enable row level security;
create policy knowledge_items_enforce_membership
  on public.knowledge_items
  for all
  using (
    public.is_workspace_member(knowledge_items.workspace_id)
  )
  with check (
    public.is_workspace_member(knowledge_items.workspace_id)
  );

alter table public.experiments enable row level security;
create policy experiments_enforce_membership
  on public.experiments
  for all
  using (
    public.is_workspace_member(experiments.workspace_id)
  )
  with check (
    public.is_workspace_member(experiments.workspace_id)
  );

alter table public.principles enable row level security;
create policy principles_enforce_membership
  on public.principles
  for all
  using (
    public.is_workspace_member(principles.workspace_id)
  )
  with check (
    public.is_workspace_member(principles.workspace_id)
  );

alter table public.insights enable row level security;
create policy insights_enforce_membership
  on public.insights
  for all
  using (
    public.is_workspace_member(insights.workspace_id)
  )
  with check (
    public.is_workspace_member(insights.workspace_id)
  );

alter table public.events enable row level security;
create policy events_enforce_membership
  on public.events
  for all
  using (
    public.is_workspace_member(events.workspace_id)
  )
  with check (
    public.is_workspace_member(events.workspace_id)
  );

alter table public.embeddings enable row level security;
create policy embeddings_enforce_membership
  on public.embeddings
  for all
  using (
    public.is_workspace_member(embeddings.workspace_id)
  )
  with check (
    public.is_workspace_member(embeddings.workspace_id)
  );

commit;
