# Voice Script Studio — Development Blueprint

**Version:** 0.3
**Date:** 2025-11-07  
**Product Owner:** TBD

> A cross-platform, voice-first assistant that interviews storytellers and delivers fully formatted scripts across film, TV, documentary, commercial, and social formats.
> Projects weave in multimodal reference boards—images, video uploads, and curated links—to ground characters, locations, tone, and production cues.

---

## 1. Product Vision

- Remove friction from script ideation by turning natural speech into structured, production-ready drafts.
- Support long-form (feature, episodic, documentary) and short-form (advertising, social shorts) storytelling.
- Deliver final documents in TXT, PDF, DOCX/RTF, Fountain, and Final Draft (FDX), sharable via download or email.
- Persist contextual metadata (genre, format, characters, locations, props, tone, constraints) across the project lifecycle, including associated visual/audio references.

### Out of Scope for v1
- Real-time multi-user editing with live cursors (roadmap).
- Budgeting and scheduling integrations (roadmap).
- Advanced rights management or watermarking (roadmap).

---

## 2. Target Users & Core Scenarios

| Persona | Scenario |
| --- | --- |
| Solo Filmmaker | Dictates logline and outline, receives full feature draft for revision. |
| Agency Creative | Produces 6/15/30/60 second ad scripts with voice-over, supers, and CTA. |
| TV Writers' Assistant | Captures beat list, expands to teleplay scenes, exports to FDX. |
| Documentary Producer | Uploads interview notes, receives narration script and beat structure. |
| Cinematographer Collaborator | Curates lighting and tone references (images/videos) that inform scene descriptions and production cues. |

---

## 3. Voice-First Experience

1. **Onboarding Interview**
   - Mic permission & calibration.
   - Slot-filling dialogue: format, target length/pages, premise, characters, locations, tone, constraints.
   - Prompts for optional reference assets (upload image/video or paste link) during character, location, and tone capture, with reminders that assets can be added later in the library.
   - Assistant summarizes captured info and requests confirmation.
2. **Iterative Drafting**
   - Outline → beat sheet → scene generation pipeline, with interruption support (“change the ending location to the pier”).
   - Inline text edits in any step are mirrored back to the canonical project state so users can revise by keyboard or touch.
3. **Review & Delivery**
   - Screenplay preview with industry-standard formatting and rich text editing for every element (slug lines, action, dialogue, parentheticals, transitions).
   - Reference sidebar shows attached mood boards and allows drag-insertion of stills or links into scene notes.
   - Export queue supporting TXT, PDF, DOCX/RTF, Fountain, and FDX; send via email or direct download.

---

## 4. Functional Requirements

- Real-time voice capture, transcription, and optional text-to-speech playback.
- Adaptive questioning: ask for missing slots only, persist answers in project state.
- Project persistence with autosave, version history, and per-version diffing.
- Script rendering engine that normalizes to a canonical JSON and emits required formats.
- Email delivery with selectable attachments and shareable download links.
- Project analytics: conversion funnel, export frequency, completion rate by script type.
- Every generated artifact is fully editable in text form with undo/redo, inline formatting controls, and change tracking.
- Reference asset management: upload images/videos, capture external video links, auto-generate thumbnails/metadata, and associate assets with characters, locations, props, tone boards, and project-level briefs.

## 5. Non-Functional Requirements

- **Latency:** <1.5s to first assistant token; <5s to produce 120-page PDF export.
- **Availability:** API 99.9% monthly; realtime subsystem 99.5%.
- **Security:** TLS everywhere, encrypted storage, PII minimization, content moderation.
- **Accessibility:** Keyboard navigation, captions/subtitles, high-contrast mode, large text.
- **Privacy Modes:** Ephemeral (no persistence), standard retention, custom retention windows.
- **Asset Handling:** Reference uploads capped at 500 MB per file (configurable), with background transcoding for large video and CDN-backed delivery with signed URLs.

---

## 6. Visual Identity & Interaction Design

- **Design Language:** Ultra-modern, clean layout with ample negative space, rounded geometry, and a glassmorphism treatment (blurred translucent panels, subtle depth shadows) that adapts to light/dark themes.
- **Motion System:** Animated waveform and particle gradients signal listening, thinking, and playback states; motion graphics are GPU-accelerated and respect accessibility preferences (e.g., `prefers-reduced-motion`).
- **Brand Moments:** Voice activation triggers branded audio-reactive visuals (looping waveforms, audio bars, holographic rings) reused consistently across web and mobile.
- **Reference Galleries:** Glass panels expand into swipeable mood boards for characters, locations, tone, and lighting—supporting stills, looping motion assets, and embedded video previews with subtle hover parallax.
- **Editing UX:** Dual-mode controls (voice + text) with floating contextual toolbars, inline suggestions, and quick-jump navigation for scenes, beats, and metadata fields.
- **Component Library:** Design tokens for color, depth, blur, and typography maintained in a shared Figma/JSON bundle and synchronized with code.
- **Accessibility:** Glass panels maintain ≥4.5:1 contrast via adaptive backdrop filters; motion capped at <400 ms with easing tuned for clarity and no essential information conveyed solely through animation.

---

## 7. Platform Strategy

- **Web:** Next.js (App Router) with TypeScript & Tailwind UI, deployed to Vercel.
- **Mobile:** React Native (Expo) for iOS (16+) and Android (9+) with shared component library (not yet implemented; current repo only includes the web surface).
- **Backend:** NestJS + Fastify, Prisma ORM (Postgres), Redis for cache/queues, S3-compatible storage.
- **Realtime Voice:** WebRTC/WebSocket relay to OpenAI Realtime sessions with server-side tool orchestration.

---

## 8. Data Architecture

### Core Entities
- `User` — profile, plan, consent flags.
- `Project` — title, script type, genre, target length, status.
- `ScriptSpec` — logline, tone, rating, structural preferences, custom constraints (JSONB).
- `Character`, `Location`, `Prop` — descriptive metadata.
- `ReferenceAsset` — uploaded media or external link metadata tied to characters, locations, props, tone boards, or project briefs.
- `EntityAsset` — join table mapping assets to specific entities with ordering, captions, and privacy flags.
- `Beat`, `Scene` — ordered narrative components with summaries and full content.
- `DraftVersion` — canonical JSON snapshot plus Fountain, FDX XML, DOCX/PDF artifacts.
- `AudioNote` — uploaded recordings and transcripts.
- `ExportJob` — asynchronous export tracking and artifact URLs.

### Persistence
- Postgres (with `pgvector`) for relational and embedding storage.
- Redis for session state, rate limits, export job queueing.
- S3/compatible object storage for audio and generated files.
- CDN-backed media bucket for reference assets with automatic thumbnail generation and optional video proxy/transcode service.

---

## 9. AI Orchestration

- Slot-filling conversation policy defined per script type (e.g., commercials require CTA and brand guidelines).
- Planner coordinates modular tools: outline planner, beat expander, scene writer, dialogue polisher, continuity checker.
- All tool outputs validated via JSON Schema; failed validation triggers automatic retries or clarifying questions.
- OpenAI Realtime for live dialogue; standard Audio/Text APIs for batch tasks.
- Reference-aware prompts leverage attached assets (captions, extracted tags, palette) to steer descriptions of characters, locations, tone, and lighting.
- Moderation layer filters unsafe content; configurable brand-safe mode for ad workflows.

---

## 10. Canonical Representation & Exports

1. Normalize every draft to a `ScriptDoc` JSON model containing metadata, characters, locations, props, beats, and scenes with structured elements.
   - Attach `referenceAssets` arrays at the project level and per entity (character/location/prop/scene) with thumbnail URLs, source type (upload vs link), captions, and attribution.
2. Derive Fountain text from `ScriptDoc`; treat Fountain as the authoritative human-readable format.
3. Generate exports:
   - **Fountain:** deterministic templates, newline management, and scene numbering.
   - **FDX:** XML serialization matching Final Draft schema (scene, element, metadata nodes).
   - **DOCX/RTF:** screenplay paragraph styles with Courier Prime-like font, proper indents and pagination.
   - **PDF:** render from Fountain using headless renderer or PDFKit with pagination rules.
   - **TXT:** plain text fallback.
4. Email/send downloads with presigned URLs and configurable expiry.

---

## 11. API Surface

### REST
- `POST /v1/projects` — create new project.
- `GET /v1/projects/:id` — fetch project summary + latest draft metadata.
- `PATCH /v1/projects/:id` — update project metadata or script spec slots.
- `POST /v1/projects/:id/notes` — upload audio note; triggers transcription job.
- `POST /v1/projects/:id/generate` — initiate generation pipeline (plan → beats → scenes → polish).
- `POST /v1/projects/:id/export` — enqueue export job.
- `GET /v1/exports/:jobId` — poll job status and retrieve artifact URLs.
- `POST /v1/email` — send selected artifacts to recipient list.
- `POST /v1/projects/:id/assets` — create project-level reference asset (file upload or link scraping).
- `POST /v1/projects/:id/entities/:entityType/:entityId/assets` — attach reference asset to character, location, prop, or scene.
- `DELETE /v1/assets/:assetId` — remove asset (with soft-delete option for audit trail).

### Realtime/WebRTC
- `wss://api.voice-script-studio.com/realtime` — session token upgrade to WebRTC with sideband channel for tool invocations and persistence.

### Webhooks
- `/webhooks/transcript.completed` — speech-to-text job finished.
- `/webhooks/export.completed` — export job artifacts ready.
- `/webhooks/asset.transcode.completed` — background video or large image processing finished; updates asset metadata with renditions.

---

## 12. Frontend Architecture

- React Query for server state cache; Zustand or Redux Toolkit for client state.
- Voice capture via `getUserMedia` (web) and Expo AV / RN-WebRTC (mobile).
- Script preview component with virtualized rendering and element-level editing, including glassmorphic panels, inline waveform animations for active scenes, and keyboard-first editing affordances.
- Offline storage using IndexedDB (web) and SQLite (mobile) with background sync.
- Feature flags via LaunchDarkly or simple environment-based toggles.
- Shared design token ingestion (colors, blur radii, motion curves) via generated TypeScript constants to keep UI in sync with brand guidelines.
- Asset library modal supporting drag/drop upload, camera roll import, link pasting with server-side unfurl, tagging, and inline display alongside narrative metadata.

---

## 13. Backend Architecture

- NestJS modules: Auth, Projects, AI Orchestrator, Transcription, Drafting, Renderer, Export, Email, Billing.
- Export worker service consumes Redis queue, renders artifacts, and stores them in S3.
- AI orchestrator abstracts providers (OpenAI primary, alternative providers pluggable).
- Observability stack: OpenTelemetry traces, structured logs (pino), metrics in Prometheus/Grafana, Sentry for errors.
- Media pipeline handles reference asset ingestion: virus scan, metadata extraction, image resizing, video proxy/transcode, link unfurl, and attribution capture.

---

## 14. Security, Privacy, and Compliance

- OAuth2/OpenID Connect authentication (Auth.js for web, token-based mobile flow).
- Role-based access control (user, admin, support).
- Rate limiting and abuse protection per IP/user.
- Content moderation filters on transcripts and generated text.
- Asset ingestion enforces virus scanning, file-type whitelists, copyright/source attribution capture, and signed URL expirations.
- GDPR/CCPA compliance: data export & delete endpoints, configurable retention windows.
- Secrets management via environment variables and secret store (e.g., Doppler, AWS Secrets Manager).

---

## 15. Testing & QA

- **Unit Tests:** slot-filling reducers, Fountain/FDX serializers, pagination calculations.
- **Integration Tests:** STT → planner → renderer pipeline with golden fixtures.
- **Media Pipeline Tests:** upload virus scanning, thumbnail generation, link unfurl, and asset-to-entity association flows.
- **End-to-End:** Playwright (web) and Detox (mobile) flows with mocked audio.
- **Contract Tests:** OpenAPI schema validation and mock server.
- **Performance Testing:** load tests on realtime and export pipelines.
- **Coverage Target:** 80% overall, ≥90% on critical exporters.

---

## 16. Deployment & DevOps

- Local dev via Docker Compose (Postgres, Redis, MinIO). `make dev` bootstraps backend, web, worker, and mobile tunnel.
- CI/CD pipeline (GitHub Actions): lint, test, build, deploy to staging.
- Staging mirrors prod topology with feature flags, seeded sample projects.
- Production deployments: API on Fly.io or Render, web on Vercel, mobile via Expo EAS.
- Automated backups for Postgres; object storage lifecycle policies (30-day retention default); CDN cache invalidation hooks for reference assets; optional FFmpeg-based media worker autoscaling.

---

## 17. Project Timeline (MVP → v1)

| Milestone | Focus | Duration |
| --- | --- | --- |
| M0 | Repo scaffold, auth, data layer, CI | 1–2 weeks |
| M1 | Voice capture, realtime transcription, slot-filling interview | 2–3 weeks |
| M2 | Outline → scene generation, script preview, reference asset library (upload/link) | 2–3 weeks |
| M3 | Exporters (Fountain, PDF, DOCX, FDX), email delivery | 2–3 weeks |
| M4 | Accessibility, telemetry, privacy modes, QA hardening | 2 weeks |

---

## 18. Risk Register & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Voice latency | Poor UX | Prefer WebRTC realtime API, prewarm sessions, compress audio, progressive responses. |
| Export fidelity | Invalid FDX/PDF | Golden fixtures, validation suite, staged rollout (Fountain/PDF first). |
| Mobile WebRTC quirks | Failed sessions | Provide WebSocket fallback, limit codecs to OPUS, extensive device lab testing. |
| Prompt drift | Inconsistent outputs | Locked system prompts, schema validation, regression tests. |
| Privacy concerns | User churn, compliance risk | Ephemeral mode, data deletion tools, clear consent and retention policies. |
| Asset bloat / unsafe media | Storage cost, compliance issues | Enforce file-size caps, scheduled lifecycle policies, automated moderation & attribution for uploads/links. |

---

## 19. Future Enhancements

- Collaborative editing with CRDT-based sync, comment threads, share links.
- Story universe knowledge base for cross-project continuity.
- Coverage/critique agents that provide notes and improvement suggestions.
- Marketplace for genre packs, brand tone guides, and exporter plugins.
- Multilingual workflows, localized screenplay norms, translation loops.
- On-device inference for privacy-sensitive users with graceful fallback to cloud.

---

## 20. Acceptance Criteria (MVP)

1. Voice onboarding captures script type, length, premise, characters, locations, props.
2. Assistant confirms collected context and allows corrections via voice or touch.
3. System generates multi-scene drafts aligned with requested format and length.
4. Users can revise any script element via rich text editor controls with full undo/redo and change tracking.
5. Visual voice states display branded waveform and glass morph animations that respect accessibility preferences.
6. Reference library supports uploading images/videos, attaching external links, tagging assets to characters/locations/props, and rendering inline previews in the editor.
7. Export pipeline delivers valid TXT, PDF, Fountain; DOCX and FDX available (feature flag if necessary).
8. Email delivery succeeds with downloadable artifacts.
9. `make dev` command boots full local stack with mock keys and passes health checks.

---

## 21. Reference Materials

- OpenAI Realtime API documentation (WebRTC and WebSocket usage).
- OpenAI Audio API (speech-to-text and text-to-speech).
- Fountain screenplay markup specification.
- Final Draft FDX schema references.
- Accessibility guidelines (WCAG 2.2 AA).
- OWASP ASVS checklist for application security.

