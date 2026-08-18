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
export async function getNext() {
    if (fixtureMode)
        return fixtureNext();
    const result = await get("/api/next");
    if (result === "network") {
        noteFixture("GET /api/next network error");
        return fixtureNext();
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
export async function postGuess(pairId, side) {
    if (fixtureMode)
        return fixtureGuess(pairId, side);
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
export { isNextDone };
