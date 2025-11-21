-- Projects metadata
-- Defines core project metadata that powers the ScriptDoc experience.

create extension if not exists "uuid-ossp";

create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  title text not null,
  script_type text not null,
  genre text,
  logline text,
  status text not null check (status in ('outline', 'draft', 'polish', 'locked')) default 'draft',
  owner_id uuid,
  tags text[] default '{}',
  target_length_unit text check (target_length_unit in ('pages', 'minutes', 'seconds')),
  target_length_value numeric,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint projects_target_length_match check (
    (target_length_unit is null and target_length_value is null)
    or (target_length_unit is not null and target_length_value is not null)
  )
);

create index if not exists projects_owner_idx on public.projects (owner_id);
create index if not exists projects_user_idx on public.projects (user_id);
create index if not exists projects_status_idx on public.projects (status);
create index if not exists projects_updated_at_idx on public.projects (updated_at desc);

create or replace function public.update_projects_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.update_projects_updated_at();

comment on table public.projects is 'Stores authoring projects tracked by Script Speech.';
comment on column public.projects.metadata is 'Arbitrary JSON metadata captured during onboarding/wizard flows.';
