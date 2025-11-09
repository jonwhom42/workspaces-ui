-- Base multi-tenant RLS contract for Supabase.
-- Run these statements in the Supabase SQL editor (or migrations) before deploying new features.

begin;

--------------------------------------------------------------------------------
-- workspaces: users can only see workspaces they explicitly belong to.
--------------------------------------------------------------------------------
alter table public.workspaces enable row level security;

create policy workspaces_select_members
  on public.workspaces
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
    )
  );

--------------------------------------------------------------------------------
-- workspace_members: scoped visibility per member + elevated visibility for owners/admins.
--------------------------------------------------------------------------------
alter table public.workspace_members enable row level security;

create policy workspace_members_select_self
  on public.workspace_members
  for select
  using (user_id = auth.uid());

create policy workspace_members_select_workspace_admins
  on public.workspace_members
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

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

commit;
