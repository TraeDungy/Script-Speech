-- Access request persistence for Script-Speech
-- Run this SQL in your Supabase project to provision the backing table.

create table if not exists public.access_requests (
  id uuid primary key,
  email text not null,
  message text,
  metadata jsonb,
  client jsonb,
  submitted_at timestamptz not null default timezone('utc', now())
);

-- Indexes to support rate limiting and listing.
create index if not exists access_requests_email_submitted_at_idx
  on public.access_requests (email, submitted_at desc);

-- RLS policies can be tightened later; for now restrict to service role usage only.
alter table public.access_requests enable row level security;

-- Allow the service role to perform full CRUD (API uses service role key).
create policy "Service role full access" on public.access_requests
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Public insert access requests" on public.access_requests;
create policy "Public insert access requests" on public.access_requests
  for insert
  with check (auth.role() in ('anon', 'authenticated', 'service_role'));
