-- Script-Speech Supabase Setup Script
-- Run this in your Supabase SQL Editor to create all necessary tables
-- https://supabase.com/dashboard/project/xlbjhocngfmvswjpbbfj/sql

-- Enable required extensions
create extension if not exists "pgcrypto";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Projects table
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  script_type text not null,
  genre text,
  logline text,
  status text not null default 'draft',
  owner_id uuid,
  user_id uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  tags text[] default array[]::text[],
  target_length_unit text check (target_length_unit in ('pages','minutes','seconds')),
  target_length_value numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Script documents table
create table if not exists public.script_docs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  doc jsonb not null,
  revision_id uuid,
  record_type text not null check (record_type in ('version','autosave')),
  version_number integer,
  source_version_id uuid references public.script_docs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  transcript_refs text[] default array[]::text[],
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists script_docs_unique_version
  on public.script_docs(project_id, version_number)
  where record_type = 'version';

create unique index if not exists script_docs_unique_autosave
  on public.script_docs(project_id)
  where record_type = 'autosave';

create index if not exists script_docs_user_idx on public.script_docs(user_id);

-- Beats table
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

-- Scenes table
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

-- Reference assets table
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

-- Entity assets table
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

-- ============================================================================
-- STUDIO ONBOARDING TABLES
-- ============================================================================

-- Project sessions table
create table if not exists public.project_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'collecting' check (status in ('collecting','confirmed','abandoned')),
  slots jsonb not null default '{}'::jsonb,
  summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_sessions_user_status_idx
  on public.project_sessions(user_id, status, created_at desc);

create index if not exists project_sessions_project_idx
  on public.project_sessions(project_id);

-- Project slot entries table
create table if not exists public.project_slot_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  session_id uuid not null references public.project_sessions(id) on delete cascade,
  slot_name text not null,
  value_text text,
  value_json jsonb,
  source text not null default 'api' check (source in ('api','text','voice','import')),
  confidence numeric,
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists project_slot_entries_session_slot_unique
  on public.project_slot_entries(session_id, slot_name);

-- Project transcripts table
create table if not exists public.project_transcripts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  session_id uuid references public.project_sessions(id) on delete cascade,
  speaker text not null,
  transcript text not null,
  source text not null default 'voice',
  confidence numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists project_transcripts_project_idx
  on public.project_transcripts(project_id, created_at desc);

create index if not exists project_transcripts_session_idx
  on public.project_transcripts(session_id, created_at desc);

-- Script specs table
create table if not exists public.script_specs (
  project_id uuid primary key references public.projects(id) on delete cascade,
  format text,
  tone_keywords text[],
  constraint_notes text,
  structural_preferences jsonb,
  rating text,
  custom_constraints jsonb,
  captured_from_session_id uuid references public.project_sessions(id) on delete set null,
  captured_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on projects
alter table public.projects enable row level security;

drop policy if exists projects_owner_select on public.projects;
create policy projects_owner_select on public.projects
  for select
  using (auth.uid() = coalesce(user_id, owner_id));

drop policy if exists projects_owner_update on public.projects;
create policy projects_owner_update on public.projects
  for update
  using (auth.uid() = coalesce(user_id, owner_id));

drop policy if exists projects_owner_delete on public.projects;
create policy projects_owner_delete on public.projects
  for delete
  using (auth.uid() = coalesce(user_id, owner_id));

drop policy if exists projects_owner_insert on public.projects;
create policy projects_owner_insert on public.projects
  for insert
  with check (auth.uid() = coalesce(user_id, owner_id));

-- Enable RLS on script_docs
alter table public.script_docs enable row level security;

drop policy if exists script_docs_owner_select on public.script_docs;
create policy script_docs_owner_select on public.script_docs
  for select
  using (auth.uid() = coalesce(user_id, (select user_id from public.projects p where p.id = project_id)));

drop policy if exists script_docs_owner_update on public.script_docs;
create policy script_docs_owner_update on public.script_docs
  for update
  using (auth.uid() = coalesce(user_id, (select user_id from public.projects p where p.id = project_id)));

drop policy if exists script_docs_owner_delete on public.script_docs;
create policy script_docs_owner_delete on public.script_docs
  for delete
  using (auth.uid() = coalesce(user_id, (select user_id from public.projects p where p.id = project_id)));

drop policy if exists script_docs_owner_insert on public.script_docs;
create policy script_docs_owner_insert on public.script_docs
  for insert
  with check (auth.uid() = coalesce(user_id, (select user_id from public.projects p where p.id = project_id)));

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to create or resume a project session
create or replace function public.create_or_resume_project_session(
  p_user_id uuid,
  p_project_title text default null,
  p_project_id uuid default null,
  p_script_type text default 'feature'
) returns public.project_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.project_sessions%rowtype;
  project_row public.projects%rowtype;
begin
  -- Check for existing collecting session
  select *
    into session_row
    from public.project_sessions
   where user_id = p_user_id
     and status = 'collecting'
   order by created_at desc
   limit 1;

  if session_row.id is not null then
    return session_row;
  end if;

  -- Get existing project or create new one
  if p_project_id is not null then
    select *
      into project_row
      from public.projects
     where id = p_project_id;
  end if;

  if project_row.id is null then
    insert into public.projects (
      title,
      script_type,
      status,
      owner_id,
      user_id,
      created_at,
      updated_at
    ) values (
      coalesce(nullif(p_project_title, ''), 'Voice Script Session'),
      coalesce(nullif(p_script_type, ''), 'feature'),
      'draft',
      p_user_id,
      p_user_id,
      now(),
      now()
    )
    returning * into project_row;
  end if;

  -- Create new session
  insert into public.project_sessions (
    project_id,
    user_id,
    status,
    slots,
    summary,
    created_at,
    updated_at
  ) values (
    project_row.id,
    p_user_id,
    'collecting',
    '{}'::jsonb,
    null,
    now(),
    now()
  )
  returning * into session_row;

  return session_row;
end;
$$;

-- ============================================================================
-- COMPLETE!
-- ============================================================================
-- All tables and functions have been created successfully.
-- You can now use the application with Supabase.
