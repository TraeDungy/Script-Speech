# Next Steps Playbook

This checklist translates the gap remediation plan into an actionable week-one roadmap. Each section highlights the deliverables, owners to fill in, and expected outputs so the team can move from marketing prototype to a durable studio preview.

## Week 1 priorities
- **Supabase enablement:** Provision Supabase project, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and confirm `access_requests` inserts succeed via API route.
- **Project + ScriptDoc schema:** Land `projects` and `script_docs` DDL in `docs/supabase/` and generate the client types needed by API routes.
- **Onboarding UI scaffold:** Create the multi-step wizard under `src/app/studio` that posts intent/genre/tone data to the new project endpoint.
- **Export/job baseline:** Add `export_jobs` schema and a polling endpoint that returns job state for the export panel.
- **Auth guardrails:** Wire Supabase Auth helpers on server components to protect studio routes behind a session check.

## Checklist to track completion
- [ ] Supabase project configured locally and in preview/staging environments.
- [ ] `projects`, `script_docs`, and `export_jobs` tables added with migrations stored in `docs/supabase/`.
- [ ] Generated types committed (e.g., `types/supabase.ts`) and referenced by new API routes.
- [ ] `POST /api/projects` creates a project + ScriptDoc record; responses validated in browser network tab.
- [ ] Onboarding wizard renders in `/studio`, persisting state via the new endpoint and showing success/error toasts.
- [ ] Export panel fetches job status from Supabase-backed API route.
- [ ] Studio routes redirect unauthenticated visitors to marketing homepage.

## How to unblock parallel streams
- Share Supabase credentials via 1Password vault and add `.env.local.example` entries for new keys.
- Coordinate schema merges by locking `docs/supabase/` during migrations; prefer additive changes.
- Use Vitest snapshots for onboarding UI to avoid brittle DOM assertions while the layout is in flux.
- Start a lightweight RFC in `docs/` before modifying agent orchestration interfaces to keep the AI contracts stable.

## Communication cadence
- **Daily standup:** Track progress against the checklist and flag schema blockers early.
- **Weekly demo:** Show onboarding wizard progress and Supabase-backed persistence working end-to-end.
- **Retro:** Capture friction points (DX, Supabase perf, auth flows) and roll them into the next plan revision.
