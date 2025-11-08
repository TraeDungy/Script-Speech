# Script-Speech

Voice-first scriptwriting assistant project. The repository now contains a Next.js (App Router) prototype for **Voice Script Studio**, aligning with the [development blueprint](docs/voice-script-studio-development.md).

## Getting Started

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` to explore the voice-first landing experience.

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
