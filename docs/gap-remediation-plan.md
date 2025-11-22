# Gap Remediation Plan

This plan breaks down the major gaps identified in the Script-Speech prototype and outlines the concrete steps required to close them. Each section lists near-term backlog items, longer-term projects, and dependencies to help sequence work.

## 1. Voice-first onboarding & adaptive drafting
- **Goal:** Move from static marketing capture to an interactive onboarding flow that collects intent via voice/text, persists projects, and seeds ScriptDocs.
- **Near-term tasks:**
  - Finish Supabase-backed project/session creation in `initializeStudioSession`, persisting onboarding slot inputs and transcript summaries.
  - Add wizard steps for tonal preferences, target deliverables, and reference assets so downstream orchestration can consume richer context.
  - Harden `/api/projects` and `/api/projects/[id]/script-doc/autosave` handlers with validation, rate limiting, and audit logs.
- **Longer-term initiatives:**
  - Iterative outline → beat → scene agents that reflect onboarding signals and preserve manual edits.
  - Bidirectional editing where voice commands update text and text edits refresh agent planning.
- **Dependencies:** Supabase project schema, realtime orchestration services, moderation/tooling for unsafe content.

## 2. Functional completeness & project lifecycle
- **Goal:** Provide end-to-end project management, autosave, export delivery, and collaboration primitives.
- **Near-term tasks:**
  - Complete Supabase persistence for ScriptDoc autosaves and wire version numbers so exports always consume the latest snapshot.
  - Replace in-memory export queue with Supabase-backed job + download tables; ensure `/api/exports/[id]` polling returns storage-signed URLs.
  - Implement email delivery for completed exports and gate downloads behind session-based AuthZ.
- **Longer-term initiatives:**
  - Version history/branching for ScriptDoc revisions, including undo timelines per collaborator.
  - Share/export permissions, approvals, and calendar hooks for studio workflows.
- **Dependencies:** Supabase storage, email delivery provider, background worker infrastructure.

## 3. Data architecture & storage hardening
- **Goal:** Move off in-process storage to managed services with durability, access control, and observability.
- **Near-term tasks:**
  - Apply Supabase SQL from `docs/supabase` (projects, script docs, studio sessions, exports, assets) and align client-side DTOs to the schema.
  - Wire asset uploads to durable object storage (Supabase Storage or S3) with signed upload/download URLs and lifecycle policies.
  - Add structured audit logs for critical mutations (project creation, autosave writes, export completion).
- **Longer-term initiatives:**
  - Introduce Redis/Upstash for caching, rate limiting, and idempotency keys.
  - Implement data retention, encryption at rest, and privacy workflows (hard delete + right-to-be-forgotten flows).
- **Dependencies:** Infrastructure provisioning, secret management strategy, logging/metrics pipeline.

## 4. AI orchestration & toolchain
- **Goal:** Deliver planner, beat, and scene agents that collaborate on story development, grounded in onboarding and reference material.
- **Near-term tasks:**
  - Finalize prompt/response schemas and JSON validation helpers; integrate retrieval utilities with Supabase pgvector for reference grounding.
  - Ship an orchestration service or route that coordinates agent calls, feeds tool outputs back to the ScriptDoc store, and persists transcripts.
  - Add evaluation hooks for tone/safety with deterministic replay of agent decisions for debugging.
- **Longer-term initiatives:**
  - Adaptive agent selection by genre/stage, plus guardrails for content policy and brand alignment.
  - Offline test harnesses and regression suites for agent behaviors.
- **Dependencies:** OpenAI API access, vector storage, evaluation dataset, orchestration runtime.

## 5. Reference asset lifecycle
- **Goal:** Support production-ready asset ingestion, scanning, and tagging through the studio.
- **Near-term tasks:**
  - Persist asset metadata in Supabase with storage bucket references and ingestion statuses surfaced in the UI.
  - Integrate antivirus/transcoding webhooks and display processing states alongside assets/beats/scenes.
  - Expose tagging endpoints that associate assets with ScriptDoc beats/scenes and feed retrieval pipelines.
- **Longer-term initiatives:**
  - Automated derivative generation (waveforms, thumbnails, captions) with CDN-backed delivery.
  - Usage analytics for asset references inside orchestration and exports.
- **Dependencies:** Media processing pipeline, storage provider, background queue.

## 6. Security, privacy, and compliance
- **Goal:** Introduce authentication, access controls, and policy enforcement aligned with studio requirements.
- **Near-term tasks:**
  - Enforce Supabase Auth on all studio/export APIs and add per-project RBAC checks.
  - Expand rate limiting to project mutations, autosave writes, and realtime session creation.
  - Add consent/PII notices for voice capture and transcript storage, plus user-facing retention controls.
- **Longer-term initiatives:**
  - Data retention policies, audit exports, and admin dashboards for access review.
  - SOC 2 aligned logging, PII redaction, and consent tracking with automated enforcement.
- **Dependencies:** Auth UX work, policy documentation, logging provider.

## 7. Testing, DevOps, and observability
- **Goal:** Establish confidence in deployments through automated testing, linting, and runtime telemetry.
- **Near-term tasks:**
  - Add unit and integration tests for API routes (marketing, access requests, projects, exports) and shared libs.
  - Configure GitHub Actions for linting, type-checking, tests, and Playwright smoke flows; publish artifacts on failure.
  - Instrument key flows with OpenTelemetry traces/metrics (onboarding wizard completion, autosave, export queue).
- **Longer-term initiatives:**
  - Supabase test containers for integration tests and contract enforcement for client DTOs.
  - Canary deploys, release automation, and feature flags for gradual rollout across platforms.
- **Dependencies:** Testing framework setup, observability vendor/collector, CI secrets management.

## 8. Cross-platform experience
- **Goal:** Extend Script-Speech beyond web to mobile and offline contexts.
- **Near-term tasks:**
  - Share ScriptDoc models, orchestration clients, and state management with an Expo scaffold for mobile parity.
  - Evaluate offline caching for script editing using SQLite/WatermelonDB and reconcile with Supabase sync.
- **Longer-term initiatives:**
  - Feature flag service coordinating progressive rollout across platforms and experiments.
  - Native integrations (call sheets, casting tools) aligned with studio workflows.
- **Dependencies:** Monorepo tooling, cross-platform design system, offline storage strategy.

## 9. Analytics and privacy
- **Goal:** Capture completion and export funnel performance while giving users control over retention and deletion.
- **Near-term tasks:**
  - Instrument onboarding completion, project creation, realtime session provisioning, and export queue events with OpenTelemetry metrics/traces and structured logs.
  - Add client instrumentation hooks to the onboarding wizard, voice loop, and export panels so funnel drop-off is observable.
  - Introduce an "ephemeral" project/session mode that bypasses persistence except for cached transcripts needed in-session, with explicit retention toggles per project.
- **Longer-term initiatives:**
  - Dashboards for completion/export funnels segmented by script type, acquisition channel, and platform.
  - Scheduled retention enforcement (TTL policies, background jobs) with audit logs for deletions and user-facing data exports.
- **Dependencies:** Telemetry backend (OTel collector + vendor), Supabase row-level TTL policies or cron jobs, product design for retention UX.

## Supabase backend decision
Supabase remains the recommended default for durable storage and auth. The repository includes SQL migrations under `docs/supabase` for access requests, marketing content, projects, script docs, exports, embeddings, and onboarding. Runtime code auto-detects Supabase via `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, falling back to JSON files for marketing/access when unavailable.

## Immediate next actions
1. Land Supabase-backed autosave and export persistence so the studio experience is durable end-to-end.
2. Wire orchestration endpoints to the studio voice loop, persisting transcripts/logs and enforcing safety/guardrails.
3. Add CI for linting, type checks, unit tests, and Playwright smoke flows with artifacts.
4. Implement retention + consent UX for voice capture and exports, with corresponding backend enforcement.

This roadmap will evolve as Supabase integration matures and as higher-priority deliverables emerge from user testing.
