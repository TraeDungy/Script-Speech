-- Marketing content storage
-- Provides editable JSON blobs for landing and FAQ copy surfaced on the marketing site.

create table if not exists public.marketing_content (
  slug text primary key,
  data jsonb not null,
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

comment on table public.marketing_content is 'Stores editable marketing JSON payloads keyed by slug (e.g. landing, faq).';
comment on column public.marketing_content.data is 'Marketing content payload rendered on the marketing site.';
