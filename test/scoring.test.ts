import { describe, expect, it } from "vitest";
import { AppError } from "../src/lib/app.ts";
import { humanSideForId } from "../src/lib/pairs.ts";
import { pointsDelta } from "../src/lib/scoring.ts";
import { handleApi } from "../src/worker.ts";
import { dayPack, makeApp, session } from "./helpers.ts";

describe("points and five-round day", () => {
  it("awards +1 or +0", () => {
    expect(pointsDelta(true)).toBe(1);
    expect(pointsDelta(false)).toBe(0);
  });

  it("adds a point on a hit and zero on a miss", async () => {
    const { app } = makeApp();
    const claimed = await app.claim(session(), "scorer", "ink-0", "4.4.4.4");
    const first = await app.next(claimed.session);
    expect("id" in first).toBe(true);
    if (!("id" in first)) throw new Error("expected a pair");
    const human = humanSideForId(first.id);
    const hit = await app.guess(claimed.session, first.id, human, "4.4.4.4");
    expect(hit.correct).toBe(true);
    expect(hit.pointsDelta).toBe(1);
    expect(hit.scoreToday).toBe(1);
    expect(hit.scoreTotal).toBe(1);
    expect(hit.next).toBeTruthy();
    expect(hit.next!.id).not.toBe(first.id);

    const second = hit.next!;
    const wrong = humanSideForId(second.id) === "left" ? "right" : "left";
    const miss = await app.guess(claimed.session, second.id, wrong, "4.4.4.4");
    expect(miss.correct).toBe(false);
    expect(miss.pointsDelta).toBe(0);
    expect(miss.scoreToday).toBe(1);
    expect(miss.scoreTotal).toBe(1);
  });

  it("returns the next unplayed pair after a hit", async () => {
    const { app } = makeApp();
    const claimed = await app.claim(session(), "nexter", "ink-2", "5.5.5.5");
    const first = await app.next(claimed.session);
    if (!("id" in first)) throw new Error("expected a pair");
    const hit = await app.guess(claimed.session, first.id, humanSideForId(first.id), "5.5.5.5");
    expect(hit.next).toMatchObject({ id: expect.any(String), topic: expect.any(String), left: expect.any(String), right: expect.any(String) });
    expect(hit.next).not.toHaveProperty("humanSide");
    expect(hit.next).not.toHaveProperty("tell");
    const again = await app.next(claimed.session);
    expect(again).toEqual(hit.next);
  });

  it("rejects a second guess on the same pair and still deals the rest of the five", async () => {
    const { app } = makeApp();
    const claimed = await app.claim(session(), "cutter", "ink-3", "2.2.2.2");
    const a = await app.next(claimed.session);
    if (!("id" in a)) throw new Error("expected a pair");
    await app.guess(claimed.session, a.id, "left", "2.2.2.2");
    await expect(app.guess(claimed.session, a.id, "right", "2.2.2.2")).rejects.toMatchObject({
      status: 409,
      code: "already_guessed",
    } satisfies Partial<AppError>);
    const b = await app.next(claimed.session);
    expect("id" in b && b.id !== a.id).toBe(true);
    if (!("id" in b)) throw new Error("expected a pair");
    const again = await app.guess(claimed.session, b.id, "left", "2.2.2.2");
    expect(again.round).toBe(2);
    expect(again.of).toBe(5);
  });

  it("caps the day at five pairs", async () => {
    const { app } = makeApp();
    const claimed = await app.claim(session(), "fiver", "ink-4", "8.8.8.8");
    const seen = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const n = await app.next(claimed.session);
      expect("id" in n).toBe(true);
      if (!("id" in n)) throw new Error("expected a pair");
      expect(seen.has(n.id)).toBe(false);
      seen.add(n.id);
      const result = await app.guess(claimed.session, n.id, "left", "8.8.8.8");
      expect(result.round).toBe(i + 1);
      expect(result.of).toBe(5);
      if (i < 4) expect(result.next?.id).toBeTruthy();
      else expect(result.next).toBeNull();
    }
    const done = await app.next(claimed.session);
    expect(done).toEqual({
      done: true,
      scoreToday: expect.any(Number),
      scoreTotal: expect.any(Number),
    });
    expect(seen.size).toBe(5);
    const extra = await app.next(claimed.session);
    if (!("id" in extra)) {
      await expect(app.guess(claimed.session, "nope", "left", "8.8.8.8")).rejects.toMatchObject({
        status: 409,
        code: "done_today",
      } satisfies Partial<AppError>);
    }
    const me = await app.me(claimed.session);
    expect(me.doneToday).toBe(true);
    expect(me.round).toBe(5);
    expect(me.of).toBe(5);
  });

  it("never puts labels on the next pair", async () => {
    const { app } = makeApp();
    const claimed = await app.claim(session(), "scorer", "ink-1", "4.4.4.4");
    const next = await app.next(claimed.session);
    expect(next).not.toHaveProperty("humanSide");
    expect(next).not.toHaveProperty("tell");
    expect(next).not.toHaveProperty("correct");
    expect(next).not.toHaveProperty("source");
    expect(next).not.toHaveProperty("model");
  });

  it("seeds today's five once, not the whole deck every deal", async () => {
    const { app, store } = makeApp();
    const claimed = await app.claim(session(), "seeder", "ink-0", "3.3.3.3");
    let writes = 0;
    const inner = store.insertPair.bind(store);
    store.insertPair = async (pair) => {
      writes += 1;
      return inner(pair);
    };
    await app.next(claimed.session);
    const afterFirst = writes;
    expect(afterFirst).toBe(5);
    await app.next(claimed.session);
    expect(writes).toBe(afterFirst);
  });

  it("resets today's score at the next UTC day and keeps all-time on the player", async () => {
    const day1 = "2026-08-17";
    const day2 = "2026-08-18";
    const { app, clock } = makeApp({
      date: day1,
      sources: [...dayPack(day1), ...dayPack(day2)],
    });
    const claimed = await app.claim(session(), "keeper", "ink-0", "1.1.1.1");
    const first = await app.next(claimed.session);
    if (!("id" in first)) throw new Error("expected a pair");
    const hit = await app.guess(claimed.session, first.id, humanSideForId(first.id), "1.1.1.1");
    expect(hit.scoreToday).toBe(1);
    expect(hit.scoreTotal).toBe(1);

    clock.date = day2;
    const nextDay = await app.me(claimed.session);
    expect(nextDay.date).toBe(day2);
    expect(nextDay.scoreToday).toBe(0);
    expect(nextDay.scoreTotal).toBe(1);
    expect(nextDay.doneToday).toBe(false);

    const again = await app.next(claimed.session);
    if (!("id" in again)) throw new Error("expected a pair");
    const hit2 = await app.guess(claimed.session, again.id, humanSideForId(again.id), "1.1.1.1");
    expect(hit2.scoreToday).toBe(1);
    expect(hit2.scoreTotal).toBe(2);
  });

  it("reattaches a lost session to the same name and keeps all-time score", async () => {
    const { app } = makeApp();
    const first = await app.claim(session("s1"), "oakdesk", "ink-0", "1.1.1.1");
    const pair = await app.next(first.session);
    if (!("id" in pair)) throw new Error("expected a pair");
    await app.guess(first.session, pair.id, humanSideForId(pair.id), "1.1.1.1");

    const lost = session("s2");
    const back = await app.claim(lost, "OakDesk", "ink-7", "9.9.9.9");
    expect(back.username).toBe("oakdesk");
    expect(back.avatar).toBe("ink-7");
    expect(back.session.playerId).toBe(first.session.playerId);
    expect(back.scoreTotal).toBe(1);

    const me = await app.me(back.session);
    expect(me).toMatchObject({ username: "oakdesk", avatar: "ink-7", scoreToday: 1, scoreTotal: 1 });
  });

  it("requires a name before play", async () => {
    const { app } = makeApp();
    await expect(app.next(session())).rejects.toMatchObject({ status: 401, code: "need_name" } satisfies Partial<AppError>);
    await expect(app.guess(session(), "x", "left", "6.6.6.6")).rejects.toMatchObject({
      status: 401,
      code: "need_name",
    } satisfies Partial<AppError>);
  });
});

describe("HTTP contract shapes", () => {
  it("claims ink avatars and serves me / next / guess / board", async () => {
    const { app } = makeApp();
    const claimRes = await handleApi(
      new Request("http://t/api/claim", {
        method: "POST",
        headers: { "content-type": "application/json", "CF-Connecting-IP": "1.1.1.1" },
        body: JSON.stringify({ username: "Ada_Lovelace", avatar: "ink-11" }),
      }),
      new URL("http://t/api/claim"),
      app,
      session(),
    );
    expect(claimRes.status).toBe(200);
    expect(await claimRes.json()).toEqual({ username: "ada_lovelace", avatar: "ink-11", scoreTotal: 0 });
    const nextSession = JSON.parse(claimRes.headers.get("X-Session")!);

    const badAvatar = await handleApi(
      new Request("http://t/api/claim", {
        method: "POST",
        headers: { "content-type": "application/json", "CF-Connecting-IP": "1.1.1.2" },
        body: JSON.stringify({ username: "other", avatar: "circle" }),
      }),
      new URL("http://t/api/claim"),
      app,
      session("s2"),
    );
    expect(badAvatar.status).toBe(400);

    const meRes = await handleApi(new Request("http://t/api/me"), new URL("http://t/api/me"), app, nextSession);
    const me = (await meRes.json()) as Record<string, unknown>;
    expect(me).toMatchObject({
      username: "ada_lovelace",
      avatar: "ink-11",
      date: "2026-08-17",
      scoreToday: 0,
      scoreTotal: 0,
      round: 1,
      of: 5,
      doneToday: false,
    });

    const nextRes = await handleApi(new Request("http://t/api/next"), new URL("http://t/api/next"), app, nextSession);
    const pair = (await nextRes.json()) as { id: string; topic: string; left: string; right: string };
    expect(pair).toEqual({
      id: expect.any(String),
      topic: expect.any(String),
      left: expect.any(String),
      right: expect.any(String),
    });
    expect(pair).not.toHaveProperty("done");

    const human = humanSideForId(pair.id);
    const guessRes = await handleApi(
      new Request("http://t/api/guess", {
        method: "POST",
        headers: { "content-type": "application/json", "CF-Connecting-IP": "1.1.1.1" },
        body: JSON.stringify({ pairId: pair.id, side: human }),
      }),
      new URL("http://t/api/guess"),
      app,
      nextSession,
    );
    const guessed = (await guessRes.json()) as Record<string, unknown>;
    expect(guessed).toMatchObject({
      correct: true,
      humanSide: human,
      pointsDelta: 1,
      scoreToday: 1,
      scoreTotal: 1,
      round: 1,
      of: 5,
    });
    expect(guessed.next).toMatchObject({
      id: expect.any(String),
      topic: expect.any(String),
      left: expect.any(String),
      right: expect.any(String),
    });

    const boardRes = await handleApi(new Request("http://t/api/board"), new URL("http://t/api/board"), app, nextSession);
    const board = (await boardRes.json()) as {
      today: Array<{ username: string; avatar: string; scoreToday: number }>;
      alltime: Array<{ username: string; avatar: string; scoreTotal: number }>;
    };
    expect(board.today).toEqual([{ username: "ada_lovelace", avatar: "ink-11", scoreToday: 1 }]);
    expect(board.alltime).toEqual([{ username: "ada_lovelace", avatar: "ink-11", scoreTotal: 1 }]);
  });
});
