-- Export workflow primitives
-- Tracks draft snapshots, queued jobs, and signed download events.

create extension if not exists "pgcrypto";

create table if not exists public.draft_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  doc jsonb not null,
  summary text,
  created_by uuid,
  created_at timestamptz not null default now()
);

comment on table public.draft_versions is 'Lightweight snapshots of ScriptDoc payloads captured for export jobs.';

create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  draft_version_id uuid references public.draft_versions(id) on delete set null,
  format text not null check (format in ('fountain','fdx','docx','pdf')),
  status text not null check (status in ('queued','processing','completed','failed')),
  deliver_to_email text,
  script_doc jsonb,
  result jsonb,
  error text,
  storage_driver text,
  storage_path text,
  storage_bucket text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.export_jobs.result is 'Serialized metadata describing the rendered artifact (file name, notes, storage driver, etc).';

create index if not exists export_jobs_project_idx
  on public.export_jobs(project_id, created_at desc);

create table if not exists public.export_download_tokens (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.export_jobs(id) on delete cascade,
  token text not null,
  signed_url text not null,
  expires_at timestamptz not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists export_download_tokens_token_idx
  on public.export_download_tokens(token);

comment on table public.export_download_tokens is 'Audit trail of signed download URLs issued for export artifacts.';
