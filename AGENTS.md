# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Stack

Cloudflare Worker + D1 + KV + static assets. No React, Next, Vercel, or Supabase. See `wrangler.toml` and `src/worker.ts`.

Local: `npx wrangler d1 migrations apply humane --local` then `npm run dev`. Tests: `npm test`. Pair catalog: `content/pairs.json`.

## Scoring API

Five pairs per UTC day. `content/pairs.json` is grouped by `play_date` with `day_index` 0–4. `src/lib/pairs.ts` picks today's five (exact date, else cycle). Schema: `migrations/0001_schema.sql`. Routes and shapes: `src/worker.ts` and `src/types.ts`.

Avatars are `ink-0`..`ink-11`. Guess is unique per player per pair. +1 correct, +0 wrong. Labels stay off `GET /api/next` and `guess.next` until a guess lands.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
