-- Ensure consistent status type for export jobs
create type if not exists public.export_job_status as enum ('queued', 'processing', 'succeeded', 'failed');

-- Normalize the existing export_jobs table to support user scoped exports
alter table if exists public.export_jobs
  drop constraint if exists export_jobs_status_check;

-- Update legacy statuses before altering the column type
update public.export_jobs
set status = 'succeeded'
where status = 'completed';

alter table if exists public.export_jobs
  alter column status type public.export_job_status using status::text::public.export_job_status,
  add column if not exists user_id uuid references auth.users(id),
  add column if not exists script_doc_id uuid references public.script_docs(id) on delete set null,
  add column if not exists error_message text,
  add column if not exists download_path text;

create index if not exists export_jobs_user_idx on public.export_jobs(user_id);
create index if not exists export_jobs_script_doc_idx on public.export_jobs(script_doc_id);
create index if not exists export_jobs_status_idx on public.export_jobs(status);

alter table if exists public.export_jobs enable row level security;

create policy if not exists export_jobs_owner_insert on public.export_jobs
  for insert
  with check (auth.uid() = user_id);

create policy if not exists export_jobs_owner_select on public.export_jobs
  for select
  using (auth.uid() = user_id);

create policy if not exists export_jobs_owner_update on public.export_jobs
  for update
  using (auth.uid() = user_id);

create policy if not exists export_jobs_owner_delete on public.export_jobs
  for delete
  using (auth.uid() = user_id);
