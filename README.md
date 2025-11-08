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

1. Create a Supabase project and execute [`docs/supabase/access-requests-table.sql`](docs/supabase/access-requests-table.sql) to provision the `access_requests` table.
2. Add the following environment variables to your `.env.local` (or hosting provider secrets):

   ```bash
   SUPABASE_URL="https://your-project-ref.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" # or set SUPABASE_KEY to use an anon key with permissive RLS
   SUPABASE_ACCESS_REQUESTS_TABLE="access_requests" # optional override
   ```

3. Restart the dev server. The `/api/request-access` endpoint will now read/write access requests in Supabase while preserving the JSON-file fallback when credentials are absent.

## Scripts

- `npm run dev` — start the development server
- `npm run build` — create a production build
- `npm run start` — run the production build locally
- `npm run lint` — check the codebase with ESLint

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

See [`docs/gap-remediation-plan.md`](docs/gap-remediation-plan.md) for the detailed remediation plan and sequencing.
