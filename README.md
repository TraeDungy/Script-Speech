# Script-Speech

Voice-first scriptwriting assistant project. The repository now contains a Next.js (App Router) prototype for **Voice Script Studio**, aligning with the [development blueprint](docs/voice-script-studio-development.md).

## Getting Started

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` to explore the voice-first landing experience.

### Supabase configuration (optional but recommended)

The application now auto-detects a Supabase backend for durable storage. To enable it:

1. Create a Supabase project and execute:
   - [`docs/supabase/access-requests-table.sql`](docs/supabase/access-requests-table.sql)
   - [`docs/supabase/export-jobs-table.sql`](docs/supabase/export-jobs-table.sql)
   - [`docs/supabase/marketing-content-table.sql`](docs/supabase/marketing-content-table.sql) for the marketing revision store.
2. Add the following environment variables to your `.env.local` (or hosting provider secrets):

   ```bash
   SUPABASE_URL="https://your-project-ref.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" # or set SUPABASE_KEY to use an anon key with permissive RLS
   SUPABASE_ACCESS_REQUESTS_TABLE="access_requests" # optional override
   NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" # exposes the URL to the browser for auth flows
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key" # used by the client to request magic links / OAuth
   MARKETING_ADMIN_EMAILS="you@example.com,partner@example.com" # comma or space separated list allowed to edit marketing copy
   ```

3. Restart the dev server. The `/api/request-access` endpoint will now read/write access requests in Supabase while preserving the JSON-file fallback when credentials are absent.

### Marketing content admin panel

Run `npm run dev` and visit `/admin/marketing` while signed in to a Supabase account whose email is listed in `MARKETING_ADMIN_EMAILS`. From there you can:

- Save draft snapshots of the landing and FAQ JSON payloads without touching the repo.
- Generate shareable previews (visible only to admins) before publishing.
- Promote a draft to production, which automatically archives the previous live revision.

Every edit is stored in Supabase with author metadata so you can audit marketing changes alongside studio data.

## Scripts

- `npm run dev` — start the development server
- `npm run build` — create a production build
- `npm run start` — run the production build locally
- `npm run lint` — check the codebase with ESLint
- `npm run type-check` — run the strict TypeScript project
- `npm run check` — convenience script that runs linting, type-checking, and unit tests (mirrors CI)

Every pull request runs the same checks via [`.github/workflows/ci.yml`](.github/workflows/ci.yml); mark those jobs as required
before merging to keep `main` healthy.

## Tech Stack

- Next.js 14 (App Router, TypeScript)
- React 18
- Tailwind CSS with custom glassmorphism tokens

## Directory Layout

```
src/
  app/            # App Router routes and layout
  components/     # Shared UI primitives (glass cards, headers)
  data/           # Structured content surfaced on the landing page
```

## Roadmap

This prototype focuses on communicating the system vision. Upcoming work will layer in live voice capture, script editing surfaces, reference asset management, and backend orchestration described in the blueprint.

See [`docs/gap-remediation-plan.md`](docs/gap-remediation-plan.md) for the detailed remediation plan and sequencing. For
observability configuration details (Grafana/DataDog, OTLP endpoints, emitted metrics), read
[`docs/observability.md`](docs/observability.md).
