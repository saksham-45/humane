# HUMANE

One pair of texts a day. Same topic. One human. One machine. Pick the human. Keep a streak.

Not a chat Turing test. Not a ten-question quiz. One shared UTC puzzle, a spoiler-safe share card, a public board, and a username that is the whole profile.

The human column is real public-domain or clearly licensed prose. The machine column is written offline. Labels never leave the server until a guess is accepted.

## Local

```sh
npm install
npx wrangler d1 migrations apply humane --local
npm run dev
```

`wrangler dev` serves `/`, `/play`, `/name`, `/board`, `/about`, the API, and share cards.

No secrets are required for local fake data. Optional `.dev.vars`:

```
SESSION_SECRET=any-long-local-string
PUBLIC_ORIGIN=http://127.0.0.1:8787
```

Apply D1 migrations once. If the `pairs` table is empty, the Worker seeds `content/pairs.json` on first request.

```sh
npm test
npm run validate:pairs
npm run typecheck
```

## Add a pair

See `content/PAIRS.md`. Short version: append a dated object to `content/pairs.json`, keep both sides in the 80–180 word band, name a real source, run `npm run validate:pairs`.

v1 ships 30 days starting 2026-08-17. Path to 200 is more dated rows in that file.

## Deploy (Cloudflare Pages + Worker + D1 + KV)

Production does not need the captain's Cloudflare login to finish the PR. When an account exists:

1. Create a D1 database named `humane` and a KV namespace.
2. Put the real IDs into `wrangler.toml` (`database_id`, KV `id`).
3. `npx wrangler d1 migrations apply humane --remote`
4. `npx wrangler secret put SESSION_SECRET`
5. Optional: set `PUBLIC_ORIGIN` to the live URL (used on the share image).
6. `npm run build:client && npx wrangler deploy`

Pages/Workers assets are the `public/` directory. The Worker owns `/api/*` and `/og/:date/:username.png`.

### Env

| Name | Required | Notes |
| --- | --- | --- |
| `SESSION_SECRET` | production | HMAC for the httpOnly session cookie. Local falls back to a documented dummy. |
| `PUBLIC_ORIGIN` | no | Origin printed on the share PNG. Default `https://humane.pages.dev`. |

No analytics SDK. No ads. The only cookie is the session after a claim (and a signed anonymous session so a second guess that day can be refused).

## Rules in brief

- One pair per UTC day, same pair for everyone.
- Play before claiming a name. A name is required to persist a streak or appear on the board.
- Username: 3–16 `[a-z0-9_]`, case-insensitive unique, reserved words blocked, first write wins.
- One official guess per player per day. Scoring is server-only.
- Board: top 50 by current streak, then longest, then earliest correct answer that day. Client refresh at most once a minute.
