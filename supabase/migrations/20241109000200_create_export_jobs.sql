-- Export jobs queue
-- Tracks background rendering requests and resulting artifacts.

create extension if not exists "pgcrypto";

create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  format text not null check (format in ('fountain','fdx','docx','pdf')),
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  deliver_to_email text,
  script_doc jsonb not null,
  result jsonb,
  error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists export_jobs_status_idx on public.export_jobs(status);
create index if not exists export_jobs_project_idx on public.export_jobs(project_id);

create or replace function public.update_export_jobs_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create trigger export_jobs_set_updated_at
before update on public.export_jobs
for each row execute function public.update_export_jobs_updated_at();

comment on table public.export_jobs is 'Stores queued export jobs for Fountain, FDX, DOCX and PDF renders.';
comment on column public.export_jobs.script_doc is 'ScriptDoc payload captured at the time the export was requested.';
comment on column public.export_jobs.result is 'JSON metadata describing the rendered asset and storage location.';
