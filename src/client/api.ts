import {
  fixtureBoard,
  fixtureGuess,
  fixtureMe,
  fixtureNext,
} from "./fixture.js";
import type {
  Board,
  GuessResponse,
  Me,
  NextResponse,
  Pair,
  Side,
} from "./types.js";
import { isNextDone } from "./types.js";

let fixtureMode = false;

export function usingFixture(): boolean {
  return fixtureMode;
}

export function noteFixture(reason: string): void {
  if (!fixtureMode) {
    fixtureMode = true;
    console.warn(`[humane] layout fixture — ${reason}. Not a second API; /api/* is the only contract.`);
  }
}

function isMissing(status: number): boolean {
  return status === 404 || status === 501 || status === 502 || status === 503;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function asSide(value: unknown): Side {
  return value === "right" ? "right" : "left";
}

function asPair(raw: unknown): Pair | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (rec.done === true) return null;
  const inner =
    rec.next && typeof rec.next === "object" && rec.next !== null && !("left" in rec)
      ? (rec.next as Record<string, unknown>)
      : rec;
  const id = String(inner.id ?? inner.pairId ?? "");
  const topic = String(inner.topic ?? "");
  const leftRaw = inner.left;
  const rightRaw = inner.right;
  const left = typeof leftRaw === "string" ? leftRaw : (leftRaw as { text?: string } | null)?.text ?? "";
  const right = typeof rightRaw === "string" ? rightRaw : (rightRaw as { text?: string } | null)?.text ?? "";
  if (!id || !left || !right) return null;
  return { id, topic, left, right };
}

function asMe(raw: unknown): Me | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const username = String(rec.username ?? "");
  if (!username) return null;
  const avatar = String(rec.avatar ?? "ink-0");
  return {
    username,
    avatar: /^ink-\d{1,2}$/.test(avatar) ? avatar : "ink-0",
    date: String(rec.date ?? ""),
    scoreToday: Number(rec.scoreToday ?? 0) || 0,
    scoreTotal: Number(rec.scoreTotal ?? 0) || 0,
    round: Math.min(5, Math.max(1, Number(rec.round ?? 1) || 1)),
    of: 5,
    doneToday: Boolean(rec.doneToday),
  };
}

function asGuess(raw: unknown): GuessResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (typeof rec.correct !== "boolean" && rec.humanSide == null) return null;
  const next = rec.next == null ? null : asPair(rec.next);
  return {
    correct: Boolean(rec.correct),
    humanSide: asSide(rec.humanSide),
    tell: String(rec.tell ?? ""),
    source: String(rec.source ?? rec.humanSource ?? ""),
    model: String(rec.model ?? rec.aiModel ?? ""),
    pointsDelta: Number(rec.pointsDelta ?? (rec.correct ? 1 : 0)) || 0,
    scoreToday: Number(rec.scoreToday ?? 0) || 0,
    scoreTotal: Number(rec.scoreTotal ?? 0) || 0,
    round: Math.min(5, Math.max(1, Number(rec.round ?? 1) || 1)),
    of: 5,
    next,
  };
}

function asBoard(raw: unknown): Board | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const todayRaw = Array.isArray(rec.today) ? rec.today : [];
  const allRaw = Array.isArray(rec.alltime) ? rec.alltime : [];
  return {
    today: todayRaw.map((row) => {
      const item = (row ?? {}) as Record<string, unknown>;
      return {
        username: String(item.username ?? ""),
        avatar: String(item.avatar ?? "ink-0"),
        scoreToday: Number(item.scoreToday ?? 0) || 0,
      };
    }),
    alltime: allRaw.map((row) => {
      const item = (row ?? {}) as Record<string, unknown>;
      return {
        username: String(item.username ?? ""),
        avatar: String(item.avatar ?? "ink-0"),
        scoreTotal: Number(item.scoreTotal ?? 0) || 0,
      };
    }),
  };
}

async function get(path: string): Promise<{ status: number; body: unknown } | "network"> {
  try {
    const res = await fetch(path, { credentials: "same-origin", headers: { accept: "application/json" } });
    return { status: res.status, body: await readJson(res) };
  } catch {
    return "network";
  }
}

async function post(path: string, payload: unknown): Promise<{ status: number; body: unknown } | "network"> {
  try {
    const res = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { status: res.status, body: await readJson(res) };
  } catch {
    return "network";
  }
}

export async function getMe(): Promise<Me | { unclaimed: true } | { fixture: Me }> {
  if (fixtureMode) return { fixture: fixtureMe() };
  const result = await get("/api/me");
  if (result === "network") {
    noteFixture("GET /api/me network error");
    return { fixture: fixtureMe() };
  }
  if (isMissing(result.status)) {
    noteFixture("GET /api/me " + result.status);
    return { fixture: fixtureMe() };
  }
  if (result.status === 401 || result.status === 403) return { unclaimed: true };
  const me = asMe(result.body);
  if (!me) return { unclaimed: true };
  return me;
}

export async function getNext(): Promise<NextResponse> {
  if (fixtureMode) return fixtureNext();
  const result = await get("/api/next");
  if (result === "network") {
    noteFixture("GET /api/next network error");
    return fixtureNext();
  }
  if (isMissing(result.status)) {
    noteFixture(`GET /api/next ${result.status}`);
    return fixtureNext();
  }
  if (result.body && typeof result.body === "object" && (result.body as { done?: boolean }).done) {
    const rec = result.body as { scoreToday?: number; scoreTotal?: number };
    return {
      done: true,
      scoreToday: Number(rec.scoreToday ?? 0) || 0,
      scoreTotal: Number(rec.scoreTotal ?? 0) || 0,
    };
  }
  const pair = asPair(result.body);
  if (!pair) {
    noteFixture("GET /api/next unreadable payload");
    return fixtureNext();
  }
  return pair;
}

export async function postGuess(pairId: string, side: Side): Promise<GuessResponse> {
  if (fixtureMode) return fixtureGuess(pairId, side);
  const result = await post("/api/guess", { pairId, side });
  if (result === "network") {
    noteFixture("POST /api/guess network error");
    return fixtureGuess(pairId, side);
  }
  if (isMissing(result.status)) {
    noteFixture(`POST /api/guess ${result.status}`);
    return fixtureGuess(pairId, side);
  }
  const guess = asGuess(result.body);
  if (!guess) {
    noteFixture("POST /api/guess unreadable payload");
    return fixtureGuess(pairId, side);
  }
  return guess;
}

export async function getBoard(): Promise<Board> {
  if (fixtureMode) return fixtureBoard();
  const result = await get("/api/board");
  if (result === "network") {
    noteFixture("GET /api/board network error");
    return fixtureBoard();
  }
  if (isMissing(result.status)) {
    noteFixture(`GET /api/board ${result.status}`);
    return fixtureBoard();
  }
  return asBoard(result.body) ?? fixtureBoard();
}

export { isNextDone };
export type { Board, GuessResponse, Me, NextResponse, Pair, Side };
