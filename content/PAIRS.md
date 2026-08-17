# Pairs

One pair is one UTC day. The Worker looks up `pairs.play_date = today's UTC date`. Nothing is generated at request time.

## Add a pair

1. Append an object to `content/pairs.json` → `pairs`.
2. Give it a unique `id` and a unique `play_date` (`YYYY-MM-DD`).
3. Fill every field:

| Field | Rule |
| --- | --- |
| `topic` | Short, concrete. Cities, crafts, food, work, weather, letters, tools, travel, sport, music practice. |
| `human` | 80–180 words. Real public-domain or clearly licensed prose you can name. Do not invent a "human." |
| `ai` | Same length band, same topic. Modern model register: tidy significance, weasel authority, missing sensory fact. Never "as an AI." |
| `human_source` | Work + origin (Gutenberg, pre-1929 essay, public-domain speech, Wikimedia license). |
| `ai_model` | e.g. `local-draft` or `grok-4.6`. Offline only. |
| `tell` | One sentence naming the human tell. Not a lecture. |

4. Run `npm run validate:pairs`. It fails on count &lt; 30, length, identical sides, missing source, or reserved words (`admin`, `humane`, `api`, `null`, `undefined`) in the text dump.
5. Local D1: empty `pairs` table is seeded from this file on first request. After you add dates, restart `wrangler dev` or wipe `.wrangler` so seed reruns. Production: apply schema, then hit the site once or run a D1 insert from this file.

## Daily picker

- `play_date` is unique. The day's pair is that row.
- Human/AI column is assigned by a stable hash of `play_date` (`src/lib/pairs.ts`), not by the order in the JSON.
- If no row exists for today, `/play` shows the empty desk. It does not wrap, invent, or pull yesterday.
- Public `GET /api/today` never includes labels. Labels live only in D1 / the Worker bundle.

## Path to 200

v1 ships 30 dates starting `2026-08-17`. Before public launch, add 170 more dated rows the same way. Prefer Gutenberg, Library of Congress PD, and Wikimedia-licensed short nonfiction. Keep the validator green.
