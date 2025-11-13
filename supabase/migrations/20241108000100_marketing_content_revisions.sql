-- Marketing content revision tracking
-- Adds revision metadata, author fields, and status workflow support.

create extension if not exists "pgcrypto";

alter table if exists public.marketing_content
  add column if not exists id uuid default gen_random_uuid();

update public.marketing_content
set id = gen_random_uuid()
where id is null;

alter table if exists public.marketing_content
  drop constraint if exists marketing_content_pkey;

alter table if exists public.marketing_content
  alter column id set not null;

alter table if exists public.marketing_content
  alter column slug set not null;

alter table if exists public.marketing_content
  add column if not exists status text not null default 'draft' check (status in ('draft','published','archived')),
  add column if not exists author_id uuid,
  add column if not exists author_name text,
  add column if not exists author_email text,
  add column if not exists published_at timestamptz;

alter table if exists public.marketing_content
  add constraint marketing_content_pkey primary key (id);

update public.marketing_content
set status = 'published'
where status is null;

update public.marketing_content
set published_at = coalesce(published_at, updated_at)
where status = 'published' and published_at is null;

create index if not exists marketing_content_slug_created_idx
  on public.marketing_content (slug, created_at desc);

create unique index if not exists marketing_content_slug_published_unique
  on public.marketing_content (slug)
  where status = 'published';

comment on column public.marketing_content.id is 'Unique revision identifier for a marketing content snapshot.';
comment on column public.marketing_content.status is 'Workflow state for the revision (draft, published, archived).';
comment on column public.marketing_content.author_id is 'Supabase auth user id of the person who saved the revision.';
comment on column public.marketing_content.author_name is 'Friendly name captured from the author at save time.';
comment on column public.marketing_content.author_email is 'Email address captured from the author at save time.';
comment on column public.marketing_content.published_at is 'Timestamp when the revision was published to the live site.';
