-- Marketing content storage with revision history
-- Provides editable JSON blobs for landing and FAQ copy surfaced on the marketing site.

create extension if not exists "pgcrypto";

create table if not exists public.marketing_content (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  data jsonb not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  author_id uuid,
  author_name text,
  author_email text,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.update_marketing_content_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create trigger marketing_content_set_updated_at
before update on public.marketing_content
for each row execute function public.update_marketing_content_updated_at();

create index if not exists marketing_content_slug_created_idx
  on public.marketing_content (slug, created_at desc);

create unique index if not exists marketing_content_slug_published_unique
  on public.marketing_content (slug)
  where status = 'published';

comment on table public.marketing_content is 'Stores editable marketing JSON payloads keyed by slug (e.g. landing, faq).';
comment on column public.marketing_content.data is 'Marketing content payload rendered on the marketing site.';
comment on column public.marketing_content.status is 'Workflow state for each saved revision.';
comment on column public.marketing_content.published_at is 'Timestamp when a revision was promoted live.';
