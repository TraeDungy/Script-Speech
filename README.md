# Script-Speech

Voice-first scriptwriting assistant project. The repository now contains a Next.js (App Router) prototype for **Voice Script Studio**, aligning with the [development blueprint](docs/voice-script-studio-development.md). Only the web surface exists today—mobile clients are not yet implemented. The app ships three main experiences:

- **Marketing landing + FAQ**: Server-rendered marketing site that pulls copy from Supabase when configured and falls back to local JSON payloads.
- **Studio prototype**: Early product shell with onboarding, voice chat, and script document scaffolding.
- **Admin controls**: Supabase-backed marketing editor that enables draft/publish flows without redeploying.

## Quickstart

1. Install dependencies and start the dev server:

   ```bash
   npm install
   npm run dev
   ```

2. Visit `http://localhost:3000` to explore the voice-first landing experience (and `/studio` for the product shell).
   - Need a shareable link for teammates? Once the dev server is running, start a tunnel (for example with `npx ngrok http 3000`)
     and share the forwarded URL. The tunnel keeps the `/`, `/studio`, and `/admin/marketing` routes available for remote testing.
3. Wire up optional backends (Supabase, Upstash Redis, OpenAI) using the guidance below, then consult [`docs/architecture.md`](docs/architecture.md) and [`docs/developer-handbook.md`](docs/developer-handbook.md) for deep dives.
4. Need to share a live preview link? Follow [`docs/preview-and-testing.md`](docs/preview-and-testing.md) for tunnel instructions and common quality checks.

### Core commands

| Task | Command |
| --- | --- |
| Development server | `npm run dev` |
| Production build | `npm run build` then `npm run start` |
| Linting | `npm run lint` |
| Type checks | `npm run type-check` |
| Unit tests | `npm run test:unit` |
| End-to-end tests (Playwright) | `npm run test:e2e` |

See [`docs/developer-handbook.md`](docs/developer-handbook.md#testing--quality) for prerequisites and test data expectations.

For a walkthrough of how the current prototype maps to the voice-first product goals (including manual editing surfaces that sit alongside voice capture), see [`docs/codebase-analysis.md`](docs/codebase-analysis.md).

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

### Environment variables cheat sheet

Add the following variables to `.env.local` (or your hosting provider). Optional values gracefully fall back to safe defaults:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_KEY` | Enable Supabase persistence for marketing content, access requests, exports, and studio objects. |
| `MARKETING_ADMIN_EMAILS` | Comma- or space-separated allowlist for accessing the marketing editor UI. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Distributed rate limiting for realtime session creation and other throttled APIs. Falls back to in-memory when absent. |
| `ORCHESTRATION_BASE_URL`, `ORCHESTRATION_API_KEY` | Optional external orchestrator for realtime sessions. When omitted, OpenAI realtime is used directly. |
| `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_VOICE` | Power realtime sessions and voice defaults. |
| `ACCESS_REQUEST_STORE_PATH`, `ACCESS_REQUEST_RATE_LIMIT_MINUTES` | Tune the file-based fallback store for access requests. |
| `EXPORT_BUCKET`, `EXPORT_PREFIX`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | S3 target for export jobs and their downloads. |

### Routes to explore

- `/` — Landing experience powered by Supabase-backed or local marketing copy.
- `/faq` — Standalone FAQ view that reuses the marketing content pipeline.
- `/studio` — Prototype workspace with onboarding wizard, reference library, and voice chat panel stubs.
- `/admin/marketing` — Draft/publish editor for marketing payloads (requires Supabase auth + allowlist).
- `/preview` — Marketing preview route used by admin links.

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

See [`docs/gap-remediation-plan.md`](docs/gap-remediation-plan.md) for the detailed remediation plan and sequencing, and [`docs/next-steps.md`](docs/next-steps.md) for the week-one execution checklist.
