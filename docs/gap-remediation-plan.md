# Gap Remediation Plan

This plan breaks down the major gaps identified in the Script-Speech prototype and outlines the concrete steps required to close them. Each section lists near-term backlog items, longer-term projects, and dependencies to help sequence work.

## 1. Voice-first onboarding & adaptive drafting
- **Goal:** Replace static marketing copy with an interactive onboarding flow that captures creator intent via voice/text and seeds a persistent ScriptDoc.
- **Near-term tasks:**
  - Implement project session state (project creation, ScriptDoc persistence) backed by Supabase.
  - Scaffold a multi-step onboarding wizard UI (outline intents, tonal preferences, deliverable goals).
  - Add voice capture pipeline that stores transcripts and metadata.
- **Longer-term initiatives:**
  - Introduce iterative outline → beat → scene agent orchestration.
  - Enable bidirectional editing (voice commands updating text, text edits re-driving voice responses).
- **Dependencies:** Supabase project schema, realtime orchestration services, moderation tooling.

## 2. Functional completeness & project lifecycle
- **Goal:** Provide end-to-end project management, autosave, export delivery, and collaboration primitives.
- **Near-term tasks:**
  - Persist projects, script docs, and export jobs in Supabase tables.
  - Replace in-memory export queue with Supabase-backed job table + status polling API.
  - Add authenticated download endpoints with signed URLs.
- **Longer-term initiatives:**
  - Version history and branching for ScriptDoc revisions.
  - Email notifications and calendar integrations for approvals.
- **Dependencies:** Supabase storage, email delivery provider, background worker infrastructure.

## 3. Data architecture & storage hardening
- **Goal:** Move off in-process storage to managed services with durability, access control, and observability.
- **Near-term tasks:**
  - Configure Supabase as the primary database (see Section 8 for schema starting point).
  - Wire asset uploads to durable object storage (Supabase Storage or S3) with signed upload URLs.
  - Add audit logging for critical mutations.
- **Longer-term initiatives:**
  - Introduce Redis/Upstash for caching and rate limiting.
  - Implement data retention, encryption at rest, and privacy workflows.
- **Dependencies:** Infrastructure provisioning, secret management strategy.

## 4. AI orchestration & toolchain
- **Goal:** Deliver planner, beat, and scene agents that collaborate on story development and respond to reference material.
- **Near-term tasks:**
  - Define canonical prompt/response schemas and JSON schema validation utilities.
  - Implement orchestration service that coordinates agent calls against OpenAI Realtime / Responses APIs.
  - Integrate reference-aware retrieval (embedding + similarity search) backed by Supabase pgvector.
- **Longer-term initiatives:**
  - Add evaluation harnesses and guardrails for tone, safety, and brand alignment.
  - Build adaptive agent selection based on project genre and stage.
- **Dependencies:** Access to OpenAI APIs, vector storage, evaluation dataset.

## 5. Reference asset lifecycle
- **Goal:** Support production-ready asset ingestion, scanning, and tagging through the studio.
- **Near-term tasks:**
  - Persist asset metadata in Supabase with storage bucket references.
  - Integrate antivirus/transcoding webhooks (e.g., Helix, Cloudflare) and update status UI accordingly.
  - Expose tagging endpoints that associate assets with beats/scenes in the ScriptDoc.
- **Longer-term initiatives:**
  - Automated derivative generation (waveforms, thumbnails, captions).
  - CDN-backed delivery with signed URLs and usage analytics.
- **Dependencies:** Media processing pipeline, storage provider, background queue.

## 6. Security, privacy, and compliance
- **Goal:** Introduce authentication, access controls, and policy enforcement that align with studio requirements.
- **Near-term tasks:**
  - Enable Supabase Auth (magic link + OAuth) and gate studio routes behind sessions.
  - Add server-side RBAC checks for project resources.
  - Expand rate limiting beyond access requests (API tokens, asset uploads).
- **Longer-term initiatives:**
  - Data retention policies, audit exports, and admin dashboards.
  - SOC 2 aligned logging, PII redaction, and consent tracking.
- **Dependencies:** Auth UX work, policy documentation, logging provider.

## 7. Testing, DevOps, and observability
- **Goal:** Establish confidence in deployments through automated testing, linting, and runtime telemetry.
- **Near-term tasks:**
  - Add unit tests for API routes and libraries (Jest + React Testing Library).
  - Configure GitHub Actions CI for linting, type-checking, and tests.
  - Instrument key flows with OpenTelemetry traces/metrics.
- **Longer-term initiatives:**
  - Add integration tests that spin up Supabase test containers.
  - Implement canary deploys and release automation.
- **Dependencies:** Testing framework setup, observability vendor.

## 8. Cross-platform experience
- **Goal:** Extend the Script-Speech experience beyond web to mobile and offline contexts. No mobile client exists yet; this repo currently ships only the Next.js surface.
- **Near-term tasks:**
  - Share core ScriptDoc models and API clients with an Expo app scaffold.
  - Evaluate offline caching for script editing using SQLite/WatermelonDB.
- **Longer-term initiatives:**
  - Feature flag service coordinating progressive rollout across platforms.
  - Native integrations (call sheets, casting tools) aligned with studio workflows.
- **Dependencies:** Monorepo tooling, cross-platform design system.

## Supabase backend decision
Setting up Supabase is the recommended next step to unblock durable storage and auth workstreams. This repository will treat Supabase as the default database, while retaining file-based fallbacks for local development. The `access_requests` table schema is provided in `docs/supabase/access-requests-table.sql` and the application auto-detects Supabase configuration via the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables.

## Immediate next actions
1. Land Supabase-backed access request persistence (implemented in this change) while keeping the local JSON fallback for contributors without Supabase credentials.
2. Create foundational Supabase tables for projects, script docs, assets, and export jobs.
3. Migrate API routes to use the new persistence layer iteratively, starting with access requests.
4. Introduce Supabase Auth and server-side session helpers to secure the studio preview.

This roadmap will evolve as Supabase integration matures and as higher-priority deliverables emerge from user testing.
