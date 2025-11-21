-- Reference asset embedding storage powered by pgvector
create extension if not exists "vector";

create table if not exists public.reference_asset_embeddings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  asset_id uuid not null references public.reference_assets(id) on delete cascade,
  chunk_index integer not null default 0,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reference_asset_embeddings_project_idx
  on public.reference_asset_embeddings(project_id, asset_id);

create index if not exists reference_asset_embeddings_embedding_idx
  on public.reference_asset_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.sync_reference_asset_embeddings(
  p_project_id uuid,
  p_asset_id uuid,
  p_rows jsonb
) returns void
language plpgsql
as $$
begin
  delete from public.reference_asset_embeddings
    where project_id = p_project_id
      and asset_id = p_asset_id;

  insert into public.reference_asset_embeddings (
    project_id,
    asset_id,
    chunk_index,
    content,
    metadata,
    embedding
  )
  select
    p_project_id,
    p_asset_id,
    coalesce((row->>'chunk_index')::int, 0),
    row->>'content',
    coalesce(row->'metadata', '{}'::jsonb),
    coalesce((row->>'embedding')::vector, '[0,0]'::vector)
  from jsonb_array_elements(p_rows) as row;
end;
$$;

create or replace function public.match_reference_asset_embeddings(
  p_project_id uuid,
  p_query_embedding vector(1536),
  p_match_count integer default 6
) returns table (
  id uuid,
  project_id uuid,
  asset_id uuid,
  chunk_index integer,
  content text,
  metadata jsonb,
  similarity double precision
)
language plpgsql
stable
as $$
begin
  return query
  select
    e.id,
    e.project_id,
    e.asset_id,
    e.chunk_index,
    e.content,
    e.metadata,
    1 - (e.embedding <=> p_query_embedding) as similarity
  from public.reference_asset_embeddings e
  where e.project_id = p_project_id
  order by e.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1);
end;
$$;
