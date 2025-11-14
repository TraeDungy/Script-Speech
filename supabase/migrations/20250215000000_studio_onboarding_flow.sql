-- Studio onboarding persistence for projects and slot capture
-- Aligns with Section 8 of docs/voice-script-studio-development.md

create extension if not exists "pgcrypto";

create table if not exists public.project_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'collecting' check (status in ('collecting','confirmed','abandoned')),
  slots jsonb not null default '{}'::jsonb,
  summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_sessions_user_status_idx
  on public.project_sessions(user_id, status, created_at desc);

create index if not exists project_sessions_project_idx
  on public.project_sessions(project_id);

create table if not exists public.project_slot_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  session_id uuid not null references public.project_sessions(id) on delete cascade,
  slot_name text not null,
  value_text text,
  value_json jsonb,
  source text not null default 'api' check (source in ('api','text','voice','import')),
  confidence numeric,
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists project_slot_entries_session_slot_unique
  on public.project_slot_entries(session_id, slot_name);

create table if not exists public.project_transcripts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  session_id uuid references public.project_sessions(id) on delete cascade,
  speaker text not null,
  transcript text not null,
  source text not null default 'voice',
  confidence numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists project_transcripts_project_idx
  on public.project_transcripts(project_id, created_at desc);

create index if not exists project_transcripts_session_idx
  on public.project_transcripts(session_id, created_at desc);

create table if not exists public.script_specs (
  project_id uuid primary key references public.projects(id) on delete cascade,
  format text,
  tone_keywords text[],
  constraint_notes text,
  structural_preferences jsonb,
  rating text,
  custom_constraints jsonb,
  captured_from_session_id uuid references public.project_sessions(id) on delete set null,
  captured_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.create_or_resume_project_session(
  p_user_id uuid,
  p_project_title text default null,
  p_project_id uuid default null,
  p_script_type text default 'feature'
) returns public.project_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.project_sessions%rowtype;
  project_row public.projects%rowtype;
begin
  select *
    into session_row
    from public.project_sessions
   where user_id = p_user_id
     and status = 'collecting'
   order by created_at desc
   limit 1;

  if session_row.id is not null then
    return session_row;
  end if;

  if p_project_id is not null then
    select *
      into project_row
      from public.projects
     where id = p_project_id;
  end if;

  if project_row.id is null then
    insert into public.projects (
      title,
      script_type,
      status,
      owner_id,
      created_at,
      updated_at
    ) values (
      coalesce(nullif(p_project_title, ''), 'Voice Script Session'),
      coalesce(nullif(p_script_type, ''), 'feature'),
      'draft',
      p_user_id,
      now(),
      now()
    )
    returning * into project_row;
  end if;

  insert into public.project_sessions (
    project_id,
    user_id,
    status,
    slots,
    summary,
    created_at,
    updated_at
  ) values (
    project_row.id,
    p_user_id,
    'collecting',
    '{}'::jsonb,
    null,
    now(),
    now()
  )
  returning * into session_row;

  return session_row;
end;
$$;

create or replace function public.capture_project_slots(
  p_session_id uuid,
  p_project_id uuid,
  p_user_id uuid,
  p_slots jsonb
) returns public.project_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.project_sessions%rowtype;
  slot_entry record;
begin
  select *
    into session_row
    from public.project_sessions
   where id = p_session_id
     and project_id = p_project_id
     and user_id = p_user_id;

  if session_row.id is null then
    raise exception 'Project session not found';
  end if;

  if p_slots is null or jsonb_typeof(p_slots) <> 'object' then
    return session_row;
  end if;

  update public.project_sessions
     set slots = coalesce(slots, '{}'::jsonb) || p_slots,
         updated_at = now()
   where id = session_row.id
  returning * into session_row;

  for slot_entry in
    select key, value
      from jsonb_each(p_slots)
  loop
    insert into public.project_slot_entries (
      project_id,
      session_id,
      slot_name,
      value_text,
      value_json,
      source,
      confidence,
      captured_at,
      updated_at
    ) values (
      session_row.project_id,
      session_row.id,
      slot_entry.key,
      slot_entry.value::text,
      slot_entry.value,
      'api',
      null,
      now(),
      now()
    )
    on conflict (session_id, slot_name) do update
      set value_text = excluded.value_text,
          value_json = excluded.value_json,
          updated_at = now();
  end loop;

  return session_row;
end;
$$;

create or replace function public.confirm_project_session(
  p_session_id uuid,
  p_project_id uuid,
  p_user_id uuid,
  p_summary jsonb default null
) returns public.project_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.project_sessions%rowtype;
  summary_json jsonb;
  tone_array text[];
begin
  update public.project_sessions
     set status = 'confirmed',
         summary = coalesce(p_summary, summary, '{}'::jsonb),
         updated_at = now()
   where id = p_session_id
     and project_id = p_project_id
     and user_id = p_user_id
  returning * into session_row;

  if session_row.id is null then
    raise exception 'Project session not found';
  end if;

  summary_json = coalesce(session_row.summary, session_row.slots, '{}'::jsonb);

  select coalesce(array_agg(value::text), '{}'::text[])
    into tone_array
    from jsonb_array_elements_text(coalesce(summary_json->'toneKeywords', '[]'::jsonb)) as value;

  insert into public.script_specs (
    project_id,
    format,
    tone_keywords,
    constraint_notes,
    structural_preferences,
    rating,
    custom_constraints,
    captured_from_session_id,
    captured_by,
    created_at,
    updated_at
  ) values (
    session_row.project_id,
    summary_json->>'format',
    tone_array,
    summary_json->>'constraints',
    summary_json->'structuralPreferences',
    summary_json->>'rating',
    summary_json,
    session_row.id,
    session_row.user_id,
    now(),
    now()
  )
  on conflict (project_id) do update
    set format = excluded.format,
        tone_keywords = excluded.tone_keywords,
        constraint_notes = excluded.constraint_notes,
        structural_preferences = excluded.structural_preferences,
        rating = excluded.rating,
        custom_constraints = excluded.custom_constraints,
        captured_from_session_id = excluded.captured_from_session_id,
        captured_by = excluded.captured_by,
        updated_at = now();

  return session_row;
end;
$$;

create or replace function public.log_project_transcript(
  p_session_id uuid,
  p_project_id uuid,
  p_user_id uuid,
  p_transcript text,
  p_speaker text default 'user',
  p_source text default 'voice',
  p_confidence numeric default null,
  p_metadata jsonb default '{}'::jsonb
) returns public.project_transcripts
language plpgsql
security definer
set search_path = public
as $$
declare
  transcript_row public.project_transcripts%rowtype;
  has_session boolean;
begin
  if p_transcript is null or length(trim(p_transcript)) = 0 then
    raise exception 'Transcript text is required';
  end if;

  select true
    into has_session
    from public.project_sessions
   where id = p_session_id
     and project_id = p_project_id
     and user_id = p_user_id;

  if not has_session then
    raise exception 'Project session not found';
  end if;

  insert into public.project_transcripts (
    project_id,
    session_id,
    speaker,
    transcript,
    source,
    confidence,
    metadata,
    created_at
  ) values (
    p_project_id,
    p_session_id,
    coalesce(nullif(p_speaker, ''), 'user'),
    p_transcript,
    coalesce(nullif(p_source, ''), 'voice'),
    p_confidence,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  returning * into transcript_row;

  return transcript_row;
end;
$$;
