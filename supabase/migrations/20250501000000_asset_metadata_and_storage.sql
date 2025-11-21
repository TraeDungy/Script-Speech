-- Add lifecycle metadata and storage details to reference assets
alter table reference_assets
  add column if not exists storage_key text,
  add column if not exists beat_tags jsonb default '[]'::jsonb not null,
  add column if not exists scene_tags jsonb default '[]'::jsonb not null;

-- Index to optimise project/status lookups
create index if not exists reference_assets_project_status_idx
  on reference_assets (project_id, status);

-- Ensure storage bucket exists for reference assets
insert into storage.buckets (id, name, public)
select 'reference-assets', 'reference-assets', true
where not exists (select 1 from storage.buckets where id = 'reference-assets');

-- Basic bucket policies are expected to be managed separately.
