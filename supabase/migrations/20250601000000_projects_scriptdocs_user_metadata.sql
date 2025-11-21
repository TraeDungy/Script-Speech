-- Align projects and script_docs with application auth and metadata expectations

-- Project status enum used by the API layer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t WHERE t.typname = 'project_status'
  ) THEN
    CREATE TYPE public.project_status AS ENUM ('outline','draft','polish','locked');
  END IF;
END $$;

ALTER TABLE IF EXISTS public.projects
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id),
  ALTER COLUMN status TYPE public.project_status USING status::text::public.project_status,
  ALTER COLUMN updated_at SET DEFAULT now();

-- Backfill user_id from owner_id when available
UPDATE public.projects
SET user_id = COALESCE(user_id, owner_id)
WHERE user_id IS NULL;

ALTER TABLE IF EXISTS public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS projects_owner_select ON public.projects
  FOR SELECT
  USING (auth.uid() = COALESCE(user_id, owner_id));

CREATE POLICY IF NOT EXISTS projects_owner_update ON public.projects
  FOR UPDATE
  USING (auth.uid() = COALESCE(user_id, owner_id));

CREATE POLICY IF NOT EXISTS projects_owner_delete ON public.projects
  FOR DELETE
  USING (auth.uid() = COALESCE(user_id, owner_id));

CREATE POLICY IF NOT EXISTS projects_owner_insert ON public.projects
  FOR INSERT
  WITH CHECK (auth.uid() = COALESCE(user_id, owner_id));

-- ScriptDoc ownership and metadata fields expected by autosave APIs
ALTER TABLE IF EXISTS public.script_docs
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS transcript_refs text[] DEFAULT array[]::text[],
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id),
  ALTER COLUMN updated_at SET DEFAULT now();

-- Backfill ScriptDoc owners from project owners when missing
UPDATE public.script_docs d
SET user_id = COALESCE(d.user_id, p.user_id, p.owner_id)
FROM public.projects p
WHERE d.project_id = p.id
  AND d.user_id IS NULL;

CREATE INDEX IF NOT EXISTS script_docs_user_idx ON public.script_docs(user_id);
ALTER TABLE IF EXISTS public.script_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS script_docs_owner_select ON public.script_docs
  FOR SELECT
  USING (auth.uid() = COALESCE(user_id, (SELECT user_id FROM public.projects p WHERE p.id = project_id)));

CREATE POLICY IF NOT EXISTS script_docs_owner_update ON public.script_docs
  FOR UPDATE
  USING (auth.uid() = COALESCE(user_id, (SELECT user_id FROM public.projects p WHERE p.id = project_id)));

CREATE POLICY IF NOT EXISTS script_docs_owner_delete ON public.script_docs
  FOR DELETE
  USING (auth.uid() = COALESCE(user_id, (SELECT user_id FROM public.projects p WHERE p.id = project_id)));

CREATE POLICY IF NOT EXISTS script_docs_owner_insert ON public.script_docs
  FOR INSERT
  WITH CHECK (auth.uid() = COALESCE(user_id, (SELECT user_id FROM public.projects p WHERE p.id = project_id)));
