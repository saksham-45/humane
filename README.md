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

## Deploy for free (Cloudflare, not Vercel)

This app is a Cloudflare Worker + D1 + KV + static `public/` files. Vercel does not run D1 or this Worker. The free host that matches the stack is Cloudflare. A Hobby Vercel project would need a rewrite.

```sh
npm install
npm run build:client
npx wrangler login
npx wrangler d1 create humane
npx wrangler kv namespace create KV
```

Paste the printed `database_id` and KV `id` into `wrangler.toml`. Then:

```sh
npx wrangler d1 migrations apply humane --remote
npx wrangler secret put SESSION_SECRET
```

Use a long random string for `SESSION_SECRET`. Without it, production refuses to sign cookies.

Optional: set `PUBLIC_ORIGIN` in `wrangler.toml` `[vars]` to your live URL.

```sh
npm run deploy
```

That publishes the Worker and the `public/` assets. The first URL wrangler prints is live. Custom domain: Cloudflare dashboard → Workers → your worker → Triggers → Custom Domains. Still free on the Workers paid-nothing tier for this traffic.

## GitHub → Cloudflare (every push)

The live Worker is `humane`. Pushes to `main` on GitHub deploy it.

1. Repo: https://github.com/saksham-45/humane
2. GitHub Actions workflow: `.github/workflows/deploy.yml`
3. Required repo secrets:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN` (Edit Cloudflare Workers)

Optional native pipeline: Cloudflare dashboard → Worker `humane` → Settings → Builds → Connect GitHub → this repo → production branch `main` → build `npm run build:client` → deploy `npx wrangler deploy`.

Local check after deploy:

```sh
curl -sI https://YOUR-SUBDOMAIN.workers.dev | head
curl -s https://YOUR-SUBDOMAIN.workers.dev/api/me
```

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
