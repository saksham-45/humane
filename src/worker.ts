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
        return await handleDynamic(request, env, url);
      } catch (err) {
        if (err instanceof AppError) return json({ error: err.code, message: err.message }, err.status);
        console.error(err);
        return json({ error: "server", message: "The table jammed." }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};

async function handleDynamic(request: Request, env: Env, url: URL): Promise<Response> {
  const app = makeApp(env);
  const secret = env.SESSION_SECRET || defaultSecret();
  const existing = await decodeSession(secret, readCookie(request.headers.get("Cookie")));
  const session = existing ?? newSessionId({ id: () => crypto.randomUUID() });
  const issued = !existing;
  const secure = url.protocol === "https:";

  const res = await handleApi(request, url, app, session);

  if (issued || res.headers.get("Set-Cookie")) {
    const token = await encodeSession(secret, sessionFrom(res, session));
    const headers = new Headers(res.headers);
    if (!headers.has("Set-Cookie")) headers.append("Set-Cookie", sessionCookie(token, secure));
    return new Response(res.body, { status: res.status, headers });
  }
  return res;
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
    const { session: next, username, avatar } = await app.claim(
      session,
      String(body.username ?? ""),
      String(body.avatar ?? ""),
      ip,
    );
    const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
    headers.set("X-Session", JSON.stringify(next));
    return new Response(JSON.stringify({ username, avatar }), { status: 200, headers });
  }

  if (url.pathname === "/api/me" && request.method === "GET") {
    return json(await app.me(session));
  }

  if (url.pathname === "/api/board" && request.method === "GET") {
    return json(await app.board());
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
