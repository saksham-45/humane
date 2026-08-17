import pairsJson from "../content/pairs.json";
import { AlreadyGuessedError, AppError, HumaneApp, newSessionId } from "./lib/app.ts";
import { parseDateParam, formatStamp } from "./lib/date.ts";
import { D1Store } from "./lib/d1.ts";
import { KvRateStore } from "./lib/kv-rate.ts";
import { assertNoLabels } from "./lib/pairs.ts";
import { decodeSession, defaultSecret, encodeSession, readCookie, sessionCookie } from "./lib/session.ts";
import { shareCacheKey } from "./lib/share.ts";
import { renderOgPng } from "./og/png.ts";
import type { PairSource, Session, Side } from "./types.ts";

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  ASSETS: Fetcher;
  SESSION_SECRET?: string;
  PUBLIC_ORIGIN?: string;
}

const SOURCES = (pairsJson as { pairs: PairSource[] }).pairs;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/og/")) {
      try {
        return await handleDynamic(request, env, url);
      } catch (err) {
        if (err instanceof AlreadyGuessedError) {
          return json(err.result, 409);
        }
        if (err instanceof AppError) {
          return json({ error: err.code, message: err.message }, err.status);
        }
        console.error(err);
        return json({ error: "server", message: "The desk jammed." }, 500);
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

  let res: Response;
  if (url.pathname.startsWith("/og/")) {
    res = await handleOg(url, env, app);
  } else {
    res = await handleApi(request, url, env, app, session);
  }

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

async function handleApi(
  request: Request,
  url: URL,
  env: Env,
  app: HumaneApp,
  session: Session,
): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") || "127.0.0.1";

  if (url.pathname === "/api/today" && request.method === "GET") {
    const cached = await env.KV.get(`today:${app.todayDate()}`, "json");
    if (cached && typeof cached === "object") {
      assertNoLabels(cached);
      return json(cached);
    }
    const today = await app.today();
    if (!today) return json({ error: "no_pair", message: "No cut today. The desk is empty." }, 404);
    assertNoLabels(today);
    await env.KV.put(`today:${today.date}`, JSON.stringify(today), { expirationTtl: 300 });
    return json(today);
  }

  if (url.pathname === "/api/guess" && request.method === "POST") {
    const body = await readJson(request);
    const side = body.side as Side;
    const { result, session: next } = await app.guess(session, side, ip);
    await env.KV.delete(`board:${app.todayDate()}`);
    return withSession(json(result), next);
  }

  if (url.pathname === "/api/claim" && request.method === "POST") {
    const body = await readJson(request);
    const { session: next, username } = await app.claim(session, String(body.username ?? ""), ip);
    await env.KV.delete(`board:${app.todayDate()}`);
    const secret = env.SESSION_SECRET || defaultSecret();
    const token = await encodeSession(secret, next);
    const secure = url.protocol === "https:";
    const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
    headers.set("Set-Cookie", sessionCookie(token, secure));
    headers.set("X-Session", JSON.stringify(next));
    return new Response(JSON.stringify({ username }), { status: 200, headers });
  }

  if (url.pathname === "/api/me" && request.method === "GET") {
    return json(await app.me(session));
  }

  if (url.pathname === "/api/board" && request.method === "GET") {
    const date = app.todayDate();
    const cacheKey = `board:${date}`;
    const cached = await env.KV.get(cacheKey, "json");
    const youNeed = session.playerId;
    if (cached && typeof cached === "object" && !youNeed) {
      return json(cached);
    }
    const board = await app.board(session);
    await env.KV.put(cacheKey, JSON.stringify({ date: board.date, rows: board.rows }), { expirationTtl: 60 });
    return json(board);
  }

  if (url.pathname === "/api/available" && request.method === "GET") {
    return json(await app.available(url.searchParams.get("username") ?? ""));
  }

  return json({ error: "not_found", message: "No such drawer." }, 404);
}

async function handleOg(url: URL, env: Env, app: HumaneApp): Promise<Response> {
  const m = url.pathname.match(/^\/og\/(\d{4}-\d{2}-\d{2})\/([a-z0-9_]+)\.png$/i);
  if (!m) return json({ error: "bad_og", message: "That card does not exist." }, 404);
  const date = parseDateParam(m[1]);
  if (!date) return json({ error: "bad_date", message: "Bad date." }, 400);
  const username = m[2].toLowerCase();
  let streak = Number(url.searchParams.get("s"));
  if (!Number.isFinite(streak) || streak < 0) {
    const player = await app.playerByName(username);
    streak = player?.current ?? 0;
  }
  streak = Math.floor(streak);
  const cacheKey = shareCacheKey(date, username, streak);
  const hit = await env.KV.get(cacheKey, "arrayBuffer");
  if (hit) {
    return new Response(hit, { headers: pngHeaders(true) });
  }
  const origin = env.PUBLIC_ORIGIN || `${url.protocol}//${url.host}`;
  const png = await renderOgPng({
    dateStamp: formatStamp(date),
    username,
    streak,
    origin,
  });
  await env.KV.put(cacheKey, png, { expirationTtl: 60 * 60 * 24 * 14 });
  return new Response(png.buffer as ArrayBuffer, { headers: pngHeaders(false) });
}

function pngHeaders(cached: boolean): HeadersInit {
  return {
    "content-type": "image/png",
    "cache-control": cached ? "public, max-age=86400" : "public, max-age=3600",
  };
}

function makeApp(env: Env): HumaneApp {
  return new HumaneApp({
    store: new D1Store(env.DB, env.KV),
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

function withSession(res: Response, session: Session): Response {
  const headers = new Headers(res.headers);
  headers.set("X-Session", JSON.stringify(session));
  return new Response(res.body, { status: res.status, headers });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const data = await request.json();
    if (!data || typeof data !== "object") return {};
    return data as Record<string, unknown>;
  } catch {
    return {};
  }
}
