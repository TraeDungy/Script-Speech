-- Fix Missing Database Tables for Script-Speech
-- Run this in your Supabase SQL Editor after running setup-supabase-tables.sql
-- https://supabase.com/dashboard/project/xlbjhocngfmvswjpbbfj/sql

-- ============================================================================
-- USERS TABLE (for mock user)
-- ============================================================================

-- Create users table if needed (separate from auth.users)
create table if not exists public.users (
  id uuid primary key,
  email text,
  full_name text,
  avatar_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Insert mock user for preview mode
insert into public.users (id, email, full_name, metadata, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'preview@script-speech.local',
  'Preview User',
  '{"isPreview": true}'::jsonb,
  now(),
  now()
)
on conflict (id) do update
set updated_at = now();

-- Enable RLS on users table
alter table public.users enable row level security;

-- Users can read their own data
drop policy if exists users_read_own on public.users;
create policy users_read_own on public.users
  for select
  using (auth.uid() = id);

-- Users can update their own data
drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update
  using (auth.uid() = id);

-- ============================================================================
-- REALTIME SESSIONS TABLE
-- ============================================================================

create table if not exists public.realtime_sessions (
  session_id text primary key,
  project_id uuid references public.projects(id) on delete cascade,
  ack_token text,
  expires_at timestamptz,
  session_payload jsonb,
  orchestrator_session_id text,
  last_state_patch jsonb,
  state_patch_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists realtime_sessions_project_idx
  on public.realtime_sessions(project_id);

create index if not exists realtime_sessions_expires_idx
  on public.realtime_sessions(expires_at)
  where expires_at is not null;

-- Enable RLS on realtime_sessions
alter table public.realtime_sessions enable row level security;

-- Users can access their own sessions
drop policy if exists realtime_sessions_user_access on public.realtime_sessions;
create policy realtime_sessions_user_access on public.realtime_sessions
  for all
  using (
    project_id is null or
    exists (
      select 1 from public.projects p
      where p.id = realtime_sessions.project_id
      and auth.uid() = coalesce(p.user_id, p.owner_id)
    )
  );

-- ============================================================================
-- REALTIME TRANSCRIPT TURNS TABLE
-- ============================================================================

create table if not exists public.realtime_transcript_turns (
  id text primary key,
  session_id text not null references public.realtime_sessions(session_id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  final boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists realtime_transcript_turns_session_idx
  on public.realtime_transcript_turns(session_id, created_at desc);

create index if not exists realtime_transcript_turns_project_idx
  on public.realtime_transcript_turns(project_id, created_at desc);

-- Enable RLS on realtime_transcript_turns
alter table public.realtime_transcript_turns enable row level security;

-- Users can access transcripts for their sessions/projects
drop policy if exists realtime_transcript_turns_user_access on public.realtime_transcript_turns;
create policy realtime_transcript_turns_user_access on public.realtime_transcript_turns
  for all
  using (
    project_id is null or
    exists (
      select 1 from public.projects p
      where p.id = realtime_transcript_turns.project_id
      and auth.uid() = coalesce(p.user_id, p.owner_id)
    )
  );

-- ============================================================================
-- AUDIT LOG TABLE (referenced in orchestrator service)
-- ============================================================================

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  user_id uuid,
  project_id uuid references public.projects(id) on delete set null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_user_idx
  on public.audit_log(user_id, created_at desc);

create index if not exists audit_log_project_idx
  on public.audit_log(project_id, created_at desc);

create index if not exists audit_log_action_idx
  on public.audit_log(action, created_at desc);

-- Enable RLS on audit_log
alter table public.audit_log enable row level security;

-- Users can read their own audit logs
drop policy if exists audit_log_user_read on public.audit_log;
create policy audit_log_user_read on public.audit_log
  for select
  using (auth.uid() = user_id);

-- ============================================================================
-- COMPLETE!
-- ============================================================================
-- All missing tables have been created.
-- The mock preview user has been inserted.
-- You can now test the voice control and story element extraction.
