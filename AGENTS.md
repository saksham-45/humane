# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Stack

Cloudflare Worker + static assets + D1 + KV. No React, Next, Vercel, or Supabase. See `wrangler.toml`, `src/worker.ts`, `public/`.

Local: `npx wrangler d1 migrations apply humane --local` then `npm run dev`. Tests: `npm test`. Pairs: `content/pairs.json` and `content/PAIRS.md`.

## Scoring and labels

Labels live only in D1 / the Worker bundle. `GET /api/today` must never include `human_side`, tell, source, or model. Scoring is `src/lib/app.ts` + `src/lib/scoring.ts`.

## Motion

The play cut is a critically damped spring on press (`src/client/cut.ts`, `src/client/spring.ts`). Do not replace it with a CSS fade except under `prefers-reduced-motion`. After the pick, the cut settles so both texts stay readable. Cards get a small Human/AI mark and the same streak line. Never stamp SIGNAL or Blood; verdict copy is `src/lib/reveal.ts`.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
