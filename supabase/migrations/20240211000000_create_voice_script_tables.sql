-- Voice Script Studio core tables
-- Derived from docs/voice-script-studio-development.md

create extension if not exists "pgcrypto";

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  script_type text not null,
  genre text,
  logline text,
  status text not null default 'draft',
  owner_id uuid,
  tags text[] default array[]::text[],
  target_length_unit text check (target_length_unit in ('pages','minutes','seconds')),
  target_length_value numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.script_docs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  doc jsonb not null,
  revision_id uuid,
  record_type text not null check (record_type in ('version','autosave')),
  version_number integer,
  source_version_id uuid references public.script_docs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists script_docs_unique_version
  on public.script_docs(project_id, version_number)
  where record_type = 'version';

create unique index if not exists script_docs_unique_autosave
  on public.script_docs(project_id)
  where record_type = 'autosave';

create table if not exists public.beats (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  script_doc_id uuid references public.script_docs(id) on delete cascade,
  beat_id text not null,
  title text not null,
  summary text,
  intent text,
  order_index integer not null,
  duration_seconds integer,
  spotlight_character_ids text[] default array[]::text[],
  location_ids text[] default array[]::text[],
  reference_asset_ids text[] default array[]::text[],
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists beats_project_doc_idx
  on public.beats(project_id, script_doc_id, order_index);

create table if not exists public.scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  script_doc_id uuid references public.script_docs(id) on delete cascade,
  scene_id text not null,
  beat_id text,
  title text,
  summary text,
  slugline jsonb,
  order_index integer not null,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scenes_project_doc_idx
  on public.scenes(project_id, script_doc_id, order_index);

create table if not exists public.reference_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  description text,
  source_type text not null check (source_type in ('upload','external','link')),
  url text not null,
  thumbnail_url text,
  preview_color text,
  content_type text not null,
  size bigint not null,
  tags text[] default array[]::text[],
  status text not null default 'pending' check (status in ('pending','ready')),
  attribution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reference_assets_project_idx
  on public.reference_assets(project_id, status);

create table if not exists public.entity_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  asset_id uuid not null references public.reference_assets(id) on delete cascade,
  entity_id text not null,
  entity_type text not null,
  caption text,
  order_index integer not null default 0,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entity_assets_project_entity_idx
  on public.entity_assets(project_id, entity_type, entity_id, order_index);
