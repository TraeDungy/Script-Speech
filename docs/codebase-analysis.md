# Script Speech codebase analysis

This document maps the current Next.js prototype to the product goals for a cross-platform, voice-first scriptwriting assistant, with emphasis on manual editing paths that complement voice input.

## High-level architecture
- **Frontend:** Next.js App Router (TypeScript, Tailwind). Core workspace lives at `/studio` with client-side state managed by a Zustand-backed ScriptDoc store.
- **Realtime voice:** `VoiceChatPanel` uses `createRealtimeClient` to manage OpenAI Realtime/WebRTC sessions, stream transcripts, and apply assistant tool outputs back into the ScriptDoc. Manual editing is always available because voice updates land in the same store as keyboard edits.
- **Persistence & autosave:** `useScriptDocStore` tracks ScriptDoc history with undo/redo and schedules autosave posts to `/api/projects/{id}/script-doc/autosave` when project IDs are present. This keeps manual edits, voice changes, and AI patches aligned.
- **Exports:** `ExportQueuePanel` converts ScriptDoc scenes into an export-ready shape and posts jobs for Fountain, FDX, DOCX, and PDF. It supports optional email delivery, download links, and live status polling.

## Editing surfaces (voice + manual)
- **Outline editor:** `OutlineEditor` renders beats with contentEditable fields for title, summary, and intent, plus drag-style reordering and add-beat controls. All updates flow through `useScriptDocStore` with undo/redo.
- **Scene editor:** `ScenesEditor` exposes slug lines, titles, summaries, and per-element text fields (action, dialogue, parenthetical, transition) as contentEditable areas so users can type or paste changes without using voice. Store mutations keep order and history intact.
- **Metadata & format:** Concept intelligence and format selectors update ScriptDoc metadata directly, allowing users to override AI recommendations.

## Feature coverage vs. product goals
- **Supported script types:** Registry in `lib/scriptFormats` covers feature, episodic/TV, documentary, commercial, and social/short forms. Users can override or register custom formats on the studio page.
- **Voice-first flows:** Realtime client processes transcript turns, emits partial/final text, and handles tool payloads (patches, transcript log sync). Mic state, error handling, reduced-motion accommodation, and TTS playback hooks are present, but backend orchestration must be wired for production use.
- **Manual editing:** Every beat, scene, and metadata field is editable via keyboard/mouse/touch. Undo/redo operates across edits, and autosave posts changes server-side when project IDs exist.
- **Exports & delivery:** Export queue lets users request Fountain, FDX, DOCX, and PDF plus optional email delivery. TXT/RTF variants and artifact email sending depend on implementing corresponding API handlers/storage.
- **Download/email:** UI exposes download buttons and email input; download URLs come from `/api/exports/{id}/download`. SMTP/send logic is expected server-side.
- **Accessibility:** Components use semantic controls and respect `prefers-reduced-motion`; further work is needed for full keyboard auditing and captions.
- **Persistence & history:** ScriptDoc store maintains ordered beats/scenes, deep merges AI patches, and keeps a transcript log for replaying voice interactions.

## Gaps and recommendations
- Implement export pipeline coverage for TXT and RTF/DOCX parity, and ensure email delivery hooks connect to a mailer (not just client-side input).
- Add mobile surfaces (React Native/Expo) or responsive variants for parity with the cross-platform goal (currently only the Next.js web experience exists).
- Wire realtime orchestrator endpoints and persistence APIs so autosave and export download links work outside the prototype.
- Expand accessibility testing (keyboard traps, focus order, captions for audio/voice states) and add automated checks to CI.
- Document schema backing for ScriptDoc persistence and ExportJob handling so server implementations match the client contract.
- Add analytics for completion/export funnels and introduce retention controls beyond Supabase defaults (ephemeral sessions, per-project deletion/TTL toggles).
