# Script Speech codebase analysis

This document maps the current Next.js prototype to the product goals for a cross-platform, voice-first scriptwriting assistant. It inventories the user-facing surfaces, underlying persistence, and AI/realtime hooks that exist today and highlights where manual editing and autosave flows already work.

## Runtime surfaces
- **Marketing site (`/`):** Server-rendered landing and FAQ pages hydrate a client-side marketing experience. Content is fetched from Supabase drafts/published revisions when credentials exist, with JSON fallbacks loaded from `src/data` when offline.
- **Marketing admin (`/admin/marketing`):** Auth-gated CMS that lists drafts/published revisions, previews content, and saves or publishes updates back to Supabase with author metadata.
- **Studio (`/studio`):** Voice-first workspace with onboarding wizard, ScriptDoc editors (outline, scenes, metadata), and export queue UI. Visitors without sessions are redirected to marketing; authenticated users get a server-provisioned project + studio session via Supabase.
- **Preview (`/preview`):** Minimal preview shell for quick staging of marketing content.

## State and persistence
- **Supabase-first data layer:** Database clients under `src/lib/db` cover marketing revisions, projects, script docs, assets, export jobs/downloads, and studio sessions. Supabase is auto-detected via environment variables; marketing and access requests fall back to local JSON stores when credentials are missing.
- **ScriptDoc store:** `useScriptDocStore` maintains beats/scenes, metadata, transcript logs, undo/redo history, and autosave scheduling. Autosaves post snapshots to `/api/projects/{id}/script-doc/autosave` when a project ID exists.
- **Studio session bootstrap:** `initializeStudioSession` creates projects and studio session records, registers onboarding slot inputs, and optionally persists transcripts for future orchestration runs.
- **Exports:** Export queue UI builds job payloads from the ScriptDoc and posts them to `/api/exports`. Polling surfaces status and download links once jobs are fulfilled by Supabase storage or fallback handlers.

## Voice, AI, and realtime
- **Realtime session provisioning:** `/api/realtime/session` enforces auth + rate limits and either delegates to an external orchestration service or requests an OpenAI Realtime session using configured model/voice defaults.
- **Client voice loop:** `VoiceChatPanel` uses `createRealtimeClient` to stream transcripts, play TTS replies, and apply assistant tool outputs directly to the ScriptDoc store. UI exposes mic controls, error handling, and reduced-motion accommodation while keeping manual editing always available.
- **AI orchestration stubs:** Retrieval utilities, prompt/schema helpers, and orchestration hooks exist but full multi-agent planning is not yet wired into the studio UI.

## Editing surfaces (voice + manual)
- **Outline editor:** ContentEditable fields for beat title/summary/intent with drag-style ordering and add-beat controls. All mutations flow through the ScriptDoc store with undo/redo support.
- **Scenes editor:** Slug lines, titles, summaries, and per-element text areas (action, dialogue, parenthetical, transition) are editable via keyboard/mouse/touch; changes share history with voice updates.
- **Metadata and format:** Concept intelligence widgets and script format selectors mutate ScriptDoc metadata directly and display AI recommendations with confidence gauges.

## Access, notifications, and safety
- **Access requests:** `/api/request-access` accepts marketing form submissions, normalizes client context, writes to Supabase (or a file-store fallback), and triggers notification hooks for downstream alerts.
- **Rate limiting:** Upstash Redis is preferred for distributed rate limits; an in-memory bucket keeps local development working.
- **AuthN/AuthZ:** Supabase Auth is used for admin and studio routes; server helpers gate marketing admin and studio entry points. RBAC beyond basic session checks is not yet present.

## Observability and testing posture
- **Telemetry:** OpenTelemetry spans wrap marketing content fetchers and API routes. Structured logging is used for Supabase operations and realtime provisioning paths.
- **Testing:** Vitest + React Testing Library are configured; limited unit coverage exists for marketing content loaders. CI wiring is implied but not present in-repo.

## Feature coverage vs. product goals
- **Supported script types:** Registry in `lib/scriptFormats` covers feature, episodic/TV, documentary, commercial, and social/short forms with configurable length/genre suggestions.
- **Voice-first flows:** Realtime client manages transcript turns, tool outputs, mic state, error handling, and TTS playback. Backend orchestration and durable transcript storage are stubbed but not productionized.
- **Manual editing:** Every beat, scene, and metadata field supports traditional input; undo/redo spans voice and manual changes, and autosave posts to Supabase-backed APIs when IDs are present.
- **Exports & delivery:** UI queues Fountain/FDX/DOCX/PDF exports with optional email delivery; TXT/RTF variants and actual email sending require backend completion plus storage-backed download links.
- **Download/email:** Download links resolve via `/api/exports/{id}/download`; SMTP/send logic is not implemented.
- **Accessibility:** Semantic controls and reduced-motion handling exist; full keyboard audit and captions/transcript surfacing for voice interactions are still open.
- **Persistence & history:** ScriptDoc store maintains ordering and deep merges AI patches; Supabase tables for projects/script docs exist, but version history and branching are not implemented.

## Gaps and recommendations
- Implement Supabase-backed pipelines for TXT/RTF exports and wire email delivery to a mailer service with signed download URLs.
- Harden studio persistence: finish Supabase autosave ingestion, add revision history/branching, and document schema alignment between client snapshots and Supabase tables.
- Productionize realtime orchestration: connect retrieval/agent planners to the studio UI, persist transcripts/logs, and add safety/guardrail evaluation.
- Extend access controls and auditing: add RBAC for projects/exports, rate limit project mutations, and emit audit logs for critical actions.
- Expand accessibility and analytics coverage: keyboard navigation, captions for voice sessions, funnel metrics for onboarding/export flows, and retention controls beyond Supabase defaults.
