# Previewing and testing Script-Speech

This guide summarizes how to quickly preview and test the Next.js prototype locally and how to share a temporary public link for teammates.

## Quick local preview

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server (binds to all interfaces so tunnels work):

   ```bash
   npm run dev -- --hostname 0.0.0.0 --port 3000
   ```

3. Open the app at <http://localhost:3000>. Useful routes:
   - `/` — landing page
   - `/faq` — FAQ view
   - `/studio` — studio shell
   - `/admin/marketing` — marketing editor (requires Supabase auth + allowlist)
   - `/preview` — marketing preview flow

## Sharing a temporary public link

If you need to give someone an external preview without deploying, you can tunnel your local dev server. One option is [`localtunnel`](https://github.com/localtunnel/localtunnel):

```bash
# in one terminal
npm run dev -- --hostname 0.0.0.0 --port 3000

# in another terminal
npx localtunnel --port 3000 --print-requests
```

After `localtunnel` starts, it prints a URL like `https://<your-subdomain>.loca.lt`. Share that URL for a temporary public preview; Ctrl+C to shut it down when you are done. Any tunnel solution that forwards port 3000 will work if your environment blocks this specific host.

## Core checks

Common quality gates you can run before sharing a preview:

- Lint: `npm run lint`
- Type check: `npm run type-check`
- Unit tests: `npm run test:unit`
- E2E tests (Playwright): `npm run test:e2e`
- Production build + start: `npm run build && npm run start`

See [`docs/developer-handbook.md`](./developer-handbook.md#testing--quality) for test data expectations and additional notes.
