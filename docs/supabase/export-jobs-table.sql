-- Export jobs queue
-- Creates a table to track rendering requests and store resulting assets.

create extension if not exists "uuid-ossp";

create table if not exists public.export_jobs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  format text not null check (format in ('fountain', 'fdx', 'docx', 'pdf')),
  status text not null check (status in ('queued', 'processing', 'completed', 'failed')) default 'queued',
  deliver_to_email text,
  script_doc jsonb not null,
  result jsonb,
  error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists export_jobs_status_idx on public.export_jobs (status);
create index if not exists export_jobs_project_idx on public.export_jobs (project_id);

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
comment on column public.export_jobs.result is 'JSON metadata describing the rendered asset and its storage location.';

-- Claim queued jobs in a single atomic update so concurrent workers don't double-process them.
create or replace function public.claim_export_jobs(claim_limit integer default 5)
returns setof public.export_jobs
language sql
as $$
  with candidates as (
    select id
    from public.export_jobs
    where status = 'queued'
    order by created_at asc
    limit claim_limit
    for update skip locked
  ),
  updated as (
    update public.export_jobs
    set status = 'processing'
    where id in (select id from candidates)
    returning public.export_jobs.*
  )
  select * from updated;
$$;
