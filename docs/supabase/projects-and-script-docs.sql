-- Core project + script doc storage for Script Speech
-- Execute within your Supabase project's SQL editor.

create extension if not exists "pgcrypto" with schema public;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  script_type text not null,
  genre text,
  logline text,
  status text not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  owner_id uuid,
  tags text[],
  target_length_unit text,
  target_length_value integer
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner','editor','member','viewer','admin')),
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.script_docs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  doc jsonb not null,
  revision_id text,
  record_type text not null check (record_type in ('version','autosave')),
  version_number integer,
  source_version_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists script_docs_autosave_unique
  on public.script_docs (project_id)
  where record_type = 'autosave';

create unique index if not exists script_docs_version_unique
  on public.script_docs (project_id, version_number)
  where record_type = 'version';

create table if not exists public.project_transcript_turns (
  id text primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  session_id text,
  user_id uuid,
  role text not null,
  text text not null,
  final boolean not null default true,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists project_transcript_turns_project_created_idx
  on public.project_transcript_turns (project_id, created_at);

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.script_docs enable row level security;
alter table public.project_transcript_turns enable row level security;

create policy if not exists "Service role full access" on public.projects
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy if not exists "Service role full access" on public.project_members
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy if not exists "Service role full access" on public.script_docs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy if not exists "Service role full access" on public.project_transcript_turns
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
