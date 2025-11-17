-- Claim queued export jobs atomically to avoid duplicate processing
-- Returns the rows that were moved to processing in this call.

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
