-- Seeds & Knowledge model tables for multi-tenant workspaces.
-- Run in Supabase SQL editor or as part of migrations.

create table if not exists public.seeds (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  title text not null,
  summary text,
  why_it_matters text,
  status text not null default 'germinating',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_seeds_workspace_id on public.seeds (workspace_id);

create table if not exists public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  seed_id uuid references public.seeds (id) on delete set null,
  created_by uuid not null references auth.users (id),
  type text not null,
  title text,
  content text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_items_workspace_seed
  on public.knowledge_items (workspace_id, seed_id);

create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  seed_id uuid not null references public.seeds (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  title text not null,
  hypothesis text,
  plan text,
  status text not null default 'planned',
  result_summary text,
  impact smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_experiments_workspace_seed
  on public.experiments (workspace_id, seed_id);

create table if not exists public.principles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  seed_id uuid references public.seeds (id) on delete set null,
  created_by uuid not null references auth.users (id),
  statement text not null,
  category text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_principles_workspace_seed
  on public.principles (workspace_id, seed_id);

create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  seed_id uuid references public.seeds (id) on delete set null,
  created_by uuid not null references auth.users (id),
  source_type text,
  source_id uuid,
  summary text not null,
  details text,
  confidence smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_insights_workspace_seed
  on public.insights (workspace_id, seed_id);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id),
  seed_id uuid references public.seeds (id) on delete set null,
  type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_workspace on public.events (workspace_id, created_at desc);

-- Embeddings scaffold (assumes pgvector enabled separately).
create table if not exists public.embeddings (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  seed_id uuid references public.seeds (id) on delete set null,
  item_type text not null,
  item_id uuid not null,
  embedding vector(1536) not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_embeddings_workspace on public.embeddings (workspace_id);

create or replace function public.match_workspace_embeddings(
  p_workspace_id uuid,
  p_seed_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 8
)
returns table(
  id bigint,
  item_type text,
  item_id uuid,
  metadata jsonb,
  seed_id uuid,
  distance double precision
)
language plpgsql
as $$
begin
  return query
    select
      e.id,
      e.item_type,
      e.item_id,
      e.metadata,
      e.seed_id,
      (e.embedding <-> p_query_embedding) as distance
    from public.embeddings e
    where e.workspace_id = p_workspace_id
      and (p_seed_id is null or e.seed_id = p_seed_id)
    order by e.embedding <-> p_query_embedding
    limit coalesce(p_match_count, 8);
end;
$$;
