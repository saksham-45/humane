import pairsJson from "../content/pairs.json";
import { AppError, HumaneApp, newSessionId } from "./lib/app.ts";
import { D1Store } from "./lib/d1.ts";
import { KvRateStore } from "./lib/kv-rate.ts";
import { assertNoLabels } from "./lib/pairs.ts";
import { decodeSession, defaultSecret, encodeSession, readCookie, sessionCookie } from "./lib/session.ts";
import type { PairSource, Session, Side } from "./types.ts";

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  ASSETS: Fetcher;
  SESSION_SECRET?: string;
}

const SOURCES = (pairsJson as { pairs: PairSource[] }).pairs;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return withSecurity(await handleDynamic(request, env, url), "api");
      } catch (err) {
        if (err instanceof AppError) return withSecurity(json({ error: err.code, message: err.message }, err.status), "api");
        console.error(err);
        return withSecurity(json({ error: "server", message: "The table jammed." }, 500), "api");
      }
    }
    const asset = await env.ASSETS.fetch(request);
    return withSecurity(asset, cacheKind(url.pathname));
  },
};

function sessionSecret(env: Env, url: URL): string {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (!local) throw new AppError(500, "server", "The table jammed.");
  return defaultSecret();
}

async function handleDynamic(request: Request, env: Env, url: URL): Promise<Response> {
  const app = makeApp(env);
  const secret = sessionSecret(env, url);
  const existing = await decodeSession(secret, readCookie(request.headers.get("Cookie")));
  const session = existing ?? newSessionId({ id: () => crypto.randomUUID() });
  const issued = !existing;
  const secure = url.protocol === "https:";

  const res = await handleApi(request, url, app, session);
  return withSessionCookie(res, session, secret, issued, secure);
}

function cacheKind(pathname: string): "html" | "asset" | "font" | "api" {
  if (/\.(gif|png|jpe?g|svg|woff2)$/i.test(pathname)) return "font";
  if (/\.(css|js)$/i.test(pathname)) return "asset";
  return "html";
}

function withSecurity(res: Response, kind: "html" | "asset" | "font" | "api"): Response {
  const headers = new Headers(res.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (kind === "api") headers.set("Cache-Control", "no-store");
  else if (kind === "font") headers.set("Cache-Control", "public, max-age=604800, immutable");
  else if (kind === "asset") headers.set("Cache-Control", "public, max-age=3600");
  else headers.set("Cache-Control", "no-cache");
  return new Response(res.body, { status: res.status, headers });
}

function sessionFrom(res: Response, fallback: Session): Session {
  const raw = res.headers.get("X-Session");
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return fallback;
  }
}

/** Persist playerId after claim. /api/me already issued an empty cookie. */
export async function withSessionCookie(
  res: Response,
  session: Session,
  secret: string,
  issued: boolean,
  secure: boolean,
): Promise<Response> {
  const next = sessionFrom(res, session);
  const changed = next.id !== session.id || next.playerId !== session.playerId;
  if (!issued && !changed && !res.headers.get("Set-Cookie")) return res;
  const token = await encodeSession(secret, next);
  const headers = new Headers(res.headers);
  if (!headers.has("Set-Cookie")) headers.append("Set-Cookie", sessionCookie(token, secure));
  return new Response(res.body, { status: res.status, headers });
}

export async function handleApi(
  request: Request,
  url: URL,
  app: HumaneApp,
  session: Session,
): Promise<Response> {
  try {
    return await routeApi(request, url, app, session);
  } catch (err) {
    if (err instanceof AppError) return json({ error: err.code, message: err.message }, err.status);
    throw err;
  }
}

async function routeApi(
  request: Request,
  url: URL,
  app: HumaneApp,
  session: Session,
): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") || "127.0.0.1";

  if (url.pathname === "/api/next" && request.method === "GET") {
    const dealt = await app.next(session);
    if (!("done" in dealt && dealt.done)) assertNoLabels(dealt);
    return json(dealt);
  }

  if (url.pathname === "/api/guess" && request.method === "POST") {
    const body = await readJson(request);
    const result = await app.guess(session, String(body.pairId ?? ""), body.side as Side, ip);
    if (result.next) assertNoLabels(result.next);
    return json(result);
  }

  if (url.pathname === "/api/claim" && request.method === "POST") {
    const body = await readJson(request);
    const { session: next, username, avatar, scoreTotal } = await app.claim(
      session,
      String(body.username ?? ""),
      String(body.avatar ?? ""),
      ip,
    );
    const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
    headers.set("X-Session", JSON.stringify(next));
    return new Response(JSON.stringify({ username, avatar, scoreTotal }), { status: 200, headers });
  }

  if (url.pathname === "/api/me" && request.method === "GET") {
    return json(await app.me(session));
  }

  if (url.pathname === "/api/board" && request.method === "GET") {
    return json(await app.board());
  }

  if (url.pathname === "/api/comments" && request.method === "GET") {
    return json({ comments: await app.comments() });
  }

  if (url.pathname === "/api/comments" && request.method === "POST") {
    const body = await readJson(request);
    return json(await app.postComment(session, String(body.body ?? ""), ip));
  }

  return json({ error: "not_found", message: "No such room." }, 404);
}

export function makeApp(env: Env): HumaneApp {
  return new HumaneApp({
    store: new D1Store(env.DB),
    rates: new KvRateStore(env.KV),
    clock: { now: () => new Date() },
    ids: { id: () => crypto.randomUUID() },
    sources: SOURCES,
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (!text) return {};
    const data = JSON.parse(text) as unknown;
    if (!data || typeof data !== "object") return {};
    return data as Record<string, unknown>;
  } catch {
    return {};
  }
}
