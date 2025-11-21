-- Script document snapshots
-- Stores autosave and published ScriptDoc payloads for each project.

create extension if not exists "uuid-ossp";

create table if not exists public.script_docs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id),
  doc jsonb not null,
  revision_id text,
  record_type text not null check (record_type in ('version', 'autosave')),
  version_number integer,
  source_version_id uuid,
  transcript_refs text[] default '{}',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint script_docs_version_number_check check (
    (record_type = 'version' and version_number is not null)
    or (record_type = 'autosave' and version_number is null)
  )
);

create index if not exists script_docs_project_idx on public.script_docs (project_id, record_type, updated_at desc);
create index if not exists script_docs_version_idx on public.script_docs (project_id, version_number desc);
create index if not exists script_docs_user_idx on public.script_docs (user_id);
create unique index if not exists script_docs_autosave_project_idx
  on public.script_docs (project_id)
  where record_type = 'autosave';

create or replace function public.update_script_docs_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create trigger script_docs_set_updated_at
before update on public.script_docs
for each row execute function public.update_script_docs_updated_at();

comment on table public.script_docs is 'Stores ScriptDoc autosaves and published versions.';
comment on column public.script_docs.transcript_refs is 'Array of transcript identifiers captured during onboarding voice input.';
comment on column public.script_docs.metadata is 'Additional json payload associated with the document.';
