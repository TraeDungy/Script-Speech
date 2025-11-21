# Architecture Overview

## Top-level layout
- `src/app` contains the Next.js App Router entry points and route handlers. The root layout injects session controls for auth-aware views, and the home page is server-rendered from marketing content fetchers before handing off to the marketing experience UI.
- `src/lib` holds shared server and client utilities: marketing content loaders, persistence clients, rate limiting, orchestration, realtime helpers, and observability wrappers.
- `src/components` provides UI primitives and feature-specific components used across routes.
- `src/data` stores the local marketing content fallbacks (landing hero, FAQ feature lists, workflow stages) used when Supabase is unavailable.
- `supabase` contains SQL migrations for durable tables (access requests, marketing content revisions, exports, embeddings, onboarding) that mirror the runtime expectations in `src/lib/db`.
- `docs` captures design notes and runbooks; this file anchors the architecture map.
- Root config: `package.json` defines dev/test scripts, `next.config.ts` carries App Router settings, and Tailwind/TypeScript configs live alongside the project root.

## Marketing content delivery
- The home page fetches landing and FAQ payloads via `fetchLandingContent`/`fetchFaqContent` before rendering the marketing experience. On fetch errors, the UI surfaces a fallback notice alongside locally cached content.
- Marketing API handlers serve cached content with observability spans. They log counts, report errors, and return JSON for ISR-driven routes.
- Content resolution layers fall back gracefully: the API reads from `getLandingContent`/`getFaqContent`, which in turn try Supabase marketing revisions and then the local data files (`src/data/*`).

## Marketing admin + persistence
- The marketing admin route lists landing/FAQ revisions, loads the latest draft and published versions from Supabase, and renders an editor surface so authorized users can save drafts or publish.
- Supabase helpers manage the marketing content lifecycle: fetching published/draft revisions, listing history, saving drafts with author metadata, and archiving old published rows when promoting a revision.

## Access requests & notifications
- The `/api/request-access` endpoint accepts form submissions, normalizes client context, enforces basic validation, and stores requests.
- Persistence first targets Supabase (customizable table name) and falls back to a JSON file store to avoid data loss when credentials are absent. The handler also triggers notification hooks for downstream alerts.

## Realtime orchestration
- The `/api/realtime/session` route enforces authenticated access and rate limits, then provisions a realtime session. It prefers an external orchestration service when configured and otherwise requests an OpenAI realtime session with configurable model/voice defaults.
- Rate limiting uses Upstash Redis when credentials exist and falls back to an in-memory bucket to keep local development simple.

## External services and how to run them
- **Supabase**: Required for durable marketing content and access-request storage. Apply the SQL in `supabase/migrations/` (or the convenience scripts in `docs/supabase/*.sql`) to your project, and provide `SUPABASE_URL` plus a service key. The app will automatically fall back to file-based storage when Supabase is not configured.
- **Upstash Redis (optional)**: Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to enable distributed rate limiting; otherwise in-memory limits are used.
- **OpenAI / orchestration**: Set `OPENAI_API_KEY` (and optionally `OPENAI_REALTIME_MODEL`/`OPENAI_REALTIME_VOICE`) for direct realtime sessions. Provide `ORCHESTRATION_BASE_URL` and `ORCHESTRATION_API_KEY` to delegate session creation to an external orchestrator.
- **Local dev commands**: Use `npm run dev` for the Next.js server, `npm run lint`/`npm run test:unit`/`npm run type-check` for checks, and `npm run test:e2e` for Playwright runs.
