# Developer handbook

This guide documents the working surface area of the Script-Speech prototype so contributors can quickly find entry points, configure dependencies, and run checks.

## Repository map

- `src/app` — Next.js App Router routes for marketing, studio, admin, and API handlers.
- `src/components` — UI primitives plus domain-specific panels used across routes.
- `src/lib` — Server/client utilities for persistence (Supabase, S3), rate limiting, realtime orchestration, and marketing content resolution.
- `src/data` — Fallback marketing payloads used when Supabase is not configured.
- `tests` — Vitest unit coverage and Playwright E2E specs.
- `scripts/run-e2e-tests.mjs` — Local runner that boots the Next.js dev server before executing Playwright.

## Service dependencies

The app runs without external services but enables richer workflows when credentials are present:

- **Supabase** — Marketing draft/publish flows, access requests, export jobs, script docs, and asset metadata live here when configured. API handlers gracefully fall back to local JSON stores or mock data when Supabase credentials are absent.
- **Upstash Redis (optional)** — Distributed rate limiting for realtime endpoints; otherwise an in-memory limiter is used.
- **OpenAI / orchestrator** — `/api/realtime/session` provisions a realtime session either via OpenAI directly or a configured orchestration service.
- **S3-compatible storage** — Export job APIs write artifacts to S3 buckets defined by `EXPORT_BUCKET` and `EXPORT_PREFIX`.

See the environment variable cheat sheet in `README.md` for the exact keys and fallbacks.

## API surface overview

Use these endpoints as a map when testing or extending backend behavior:

- **Marketing content**: `GET /api/landing` and `GET /api/faq` pull Supabase revisions or local payloads; admin routes under `/api/admin/marketing/[slug]/*` manage drafts, revisions, and publish actions.
- **Request access**: `POST /api/request-access` normalizes submissions, enforces rate limits, and persists to Supabase or a local JSON file at `.data/access-requests.json`.
- **Exports**: `/api/exports` queues export jobs; `/api/exports/[jobId]` exposes status; `/api/exports/[jobId]/download` streams S3 artifacts when ready.
- **Assets**: `/api/assets` and `/api/assets/search` surface asset metadata; `/api/assets/download` wraps signed download URLs; `/api/webhooks/assets/*` receives antivirus/transcoding events.
- **Projects + script docs**: `/api/projects` CRUD helpers back the studio prototype. Nested routes handle assets (`/assets`), exports, and script doc lifecycle (`/script-docs/[id]`, autosave, versions, and orchestration helpers).
- **Realtime**: `/api/realtime/session` and `/api/realtime/orchestrator` enforce auth + rate limits before provisioning realtime connections.
- **Auth/session**: `/api/auth/session` validates Supabase sessions for client components.

## Testing & quality

- **Unit tests**: `npm run test:unit` executes Vitest suites (JSdom where applicable). Requires Node.js 18+.
- **E2E tests**: `npm run test:e2e` starts `next dev` via `scripts/run-e2e-tests.mjs` and runs Playwright against `http://localhost:3000`. Ensure ports are free before launching.
- **Type checks**: `npm run type-check` uses `tsconfig.typecheck.json` to catch TS regressions in both browser and server bundles.
- **Linting**: `npm run lint` enforces Next.js + ESLint conventions.

CI-like workflows can be replicated locally with `npm run check`, which chains linting, type checks, and unit tests.

## Local development tips

- Marketing and FAQ pages will automatically read Supabase revisions when credentials are set; otherwise the local JSON payloads in `src/data` render alongside a fallback notice.
- Access request submissions always persist locally to `.data/access-requests.json` even when Supabase is disabled, making it safe to test the form without cloud dependencies.
- The marketing admin UI requires authentication with a Supabase email listed in `MARKETING_ADMIN_EMAILS`. Without credentials, the page will render an auth prompt or an unauthorized view.
- If Upstash Redis is not configured, rate limits reset on server restarts because the in-memory bucket is used.
