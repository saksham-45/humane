import { fixtureBoard, fixtureGuess, fixtureMe, fixtureNext, } from "./fixture.js";
import { isNextDone } from "./types.js";
let fixtureMode = false;
export function usingFixture() {
    return fixtureMode;
}
export function noteFixture(reason) {
    if (!fixtureMode) {
        fixtureMode = true;
        console.warn(`[humane] layout fixture — ${reason}. Not a second API; /api/* is the only contract.`);
    }
}
function isMissing(status) {
    return status === 404 || status === 501 || status === 502 || status === 503;
}
async function readJson(res) {
    const text = await res.text();
    if (!text)
        return null;
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
function asSide(value) {
    return value === "right" ? "right" : "left";
}
function asPair(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const rec = raw;
    if (rec.done === true)
        return null;
    const inner = rec.next && typeof rec.next === "object" && rec.next !== null && !("left" in rec)
        ? rec.next
        : rec;
    const id = String(inner.id ?? inner.pairId ?? "");
    const topic = String(inner.topic ?? "");
    const leftRaw = inner.left;
    const rightRaw = inner.right;
    const left = typeof leftRaw === "string" ? leftRaw : leftRaw?.text ?? "";
    const right = typeof rightRaw === "string" ? rightRaw : rightRaw?.text ?? "";
    if (!id || !left || !right)
        return null;
    return { id, topic, left, right };
}
function asMe(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const rec = raw;
    const username = String(rec.username ?? "");
    if (!username)
        return null;
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
function asGuess(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const rec = raw;
    if (typeof rec.correct !== "boolean" && rec.humanSide == null)
        return null;
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
function asBoard(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const rec = raw;
    const todayRaw = Array.isArray(rec.today) ? rec.today : [];
    const allRaw = Array.isArray(rec.alltime) ? rec.alltime : [];
    return {
        today: todayRaw.map((row) => {
            const item = (row ?? {});
            return {
                username: String(item.username ?? ""),
                avatar: String(item.avatar ?? "ink-0"),
                scoreToday: Number(item.scoreToday ?? 0) || 0,
            };
        }),
        alltime: allRaw.map((row) => {
            const item = (row ?? {});
            return {
                username: String(item.username ?? ""),
                avatar: String(item.avatar ?? "ink-0"),
                scoreTotal: Number(item.scoreTotal ?? 0) || 0,
            };
        }),
    };
}
async function get(path) {
    try {
        const res = await fetch(path, { credentials: "same-origin", headers: { accept: "application/json" } });
        return { status: res.status, body: await readJson(res) };
    }
    catch {
        return "network";
    }
}
async function post(path, payload) {
    try {
        const res = await fetch(path, {
            method: "POST",
            credentials: "same-origin",
            headers: { accept: "application/json", "content-type": "application/json" },
            body: JSON.stringify(payload),
        });
        return { status: res.status, body: await readJson(res) };
    }
    catch {
        return "network";
    }
}
export async function getMe() {
    if (fixtureMode)
        return { fixture: fixtureMe() };
    const result = await get("/api/me");
    if (result === "network") {
        noteFixture("GET /api/me network error");
        return { fixture: fixtureMe() };
    }
    if (isMissing(result.status)) {
        noteFixture("GET /api/me " + result.status);
        return { fixture: fixtureMe() };
    }
    if (result.status === 401 || result.status === 403)
        return { unclaimed: true };
    const me = asMe(result.body);
    if (!me)
        return { unclaimed: true };
    return me;
}
function isNeedName(status, body) {
    if (status === 401 || status === 403)
        return true;
    if (!body || typeof body !== "object")
        return false;
    return body.error === "need_name";
}
export async function getNext() {
    if (fixtureMode)
        return fixtureNext();
    const result = await get("/api/next");
    if (result === "network") {
        noteFixture("GET /api/next network error");
        return fixtureNext();
    }
    if (isNeedName(result.status, result.body)) {
        return { done: true, scoreToday: 0, scoreTotal: 0, unclaimed: true };
    }
    if (isMissing(result.status)) {
        noteFixture(`GET /api/next ${result.status}`);
        return fixtureNext();
    }
    if (result.body && typeof result.body === "object" && result.body.done) {
        const rec = result.body;
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
export class PlayError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
function guessCode(status, body) {
    if (status < 400)
        return null;
    if (isNeedName(status, body))
        return "need_name";
    if (body && typeof body === "object" && "error" in body) {
        return String(body.error ?? "bad");
    }
    return "bad";
}
export async function postGuess(pairId, side) {
    if (fixtureMode)
        return fixtureGuess(pairId, side);
    const result = await post("/api/guess", { pairId, side });
    if (result === "network") {
        throw new PlayError("network", "Could not reach the table.");
    }
    const code = guessCode(result.status, result.body);
    if (code) {
        const rec = (result.body ?? {});
        throw new PlayError(code, String(rec.message ?? "That cut did not land."));
    }
    if (isMissing(result.status)) {
        noteFixture(`POST /api/guess ${result.status}`);
        return fixtureGuess(pairId, side);
    }
    const guess = asGuess(result.body);
    if (!guess) {
        throw new PlayError("bad", "That cut did not land.");
    }
    return guess;
}
export async function getBoard() {
    if (fixtureMode)
        return fixtureBoard();
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
function asComments(raw) {
    if (!raw || typeof raw !== "object")
        return [];
    const rec = raw;
    const list = Array.isArray(rec.comments) ? rec.comments : Array.isArray(raw) ? raw : [];
    return list.map((row) => {
        const item = (row ?? {});
        return {
            id: String(item.id ?? ""),
            username: String(item.username ?? ""),
            avatar: String(item.avatar ?? "ink-0"),
            body: String(item.body ?? ""),
            created_at: String(item.created_at ?? ""),
        };
    });
}
export async function getComments() {
    if (fixtureMode)
        return [];
    const result = await get("/api/comments");
    if (result === "network" || isMissing(result.status))
        return [];
    return asComments(result.body);
}
export async function postComment(body) {
    const result = await post("/api/comments", { body });
    if (result === "network")
        return { error: "network", message: "Could not reach the table." };
    const rec = (result.body ?? {});
    if (result.status >= 400 || rec.error) {
        return { error: String(rec.error ?? "bad"), message: String(rec.message ?? "That note did not stick.") };
    }
    return {
        id: String(rec.id ?? ""),
        username: String(rec.username ?? ""),
        avatar: String(rec.avatar ?? "ink-0"),
        body: String(rec.body ?? body),
        created_at: String(rec.created_at ?? ""),
    };
}
export { isNextDone };
