# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.

## Play table and avatars

Lane C owns `public/avatars/**`, `public/play/`, `public/board/`, `public/js/**`, `src/client/**`. Do not rewrite the lobby in `public/index.html` or lobby rules in `public/css/app.css`; play/board classes live in `public/js/play-table.css`.

Faces are original 32×32 SVGs `public/avatars/ink-0.svg` … `ink-11.svg`. Client TypeScript in `src/client/` compiles with `npx -p typescript tsc -p src/client/tsconfig.json` into `public/js/`.

Play talks only to `/api/me`, `/api/next`, `/api/guess`, `/api/board` (see firstmate CONTRACT). A 404 from those endpoints uses the layout fixture in `src/client/fixture.ts` — not a second API.
