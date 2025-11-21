-- Add a terminal status for export jobs once downloads are ready
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'export_job_status' AND e.enumlabel = 'completed'
  ) THEN
    ALTER TYPE public.export_job_status ADD VALUE 'completed';
  END IF;
END $$;

-- Normalize historical rows that represented completion with a legacy status
UPDATE public.export_jobs
SET status = 'completed'
WHERE status = 'succeeded' AND download_path IS NOT NULL;
