import { describe, expect, it } from "vitest";
import { HumaneApp } from "../src/lib/app.ts";
import { MemoryRateStore } from "../src/lib/rate-limit.ts";
import { nextStreak } from "../src/lib/scoring.ts";
import { MemoryStore } from "../src/lib/store.ts";
import { humanSideForDate } from "../src/lib/pairs.ts";
import { makeApp, session, source } from "./helpers.ts";

describe("server-side scoring", () => {
  it("never puts labels on the public today payload", async () => {
    const { app } = makeApp();
    const today = await app.today();
    expect(today).toBeTruthy();
    expect(today).not.toHaveProperty("humanSide");
    expect(today).not.toHaveProperty("human_side");
    expect(today).not.toHaveProperty("tell");
    expect(today).not.toHaveProperty("source");
    expect(today).not.toHaveProperty("correct");
  });

  it("scores on the server and increments a claimed streak", async () => {
    const date = "2026-08-17";
    const { app } = makeApp({ date });
    const claimed = await app.claim(session(), "scorer", "4.4.4.4");
    const human = humanSideForDate(date);
    const out = await app.guess(claimed.session, human, "4.4.4.4");
    expect(out.result.correct).toBe(true);
    expect(out.result.persisted).toBe(true);
    expect(out.result.streak).toBe(1);
    expect(out.result.tell.length).toBeGreaterThan(0);
  });

  it("resets the streak on a miss", async () => {
    const date = "2026-08-17";
    const { app } = makeApp({ date });
    const claimed = await app.claim(session(), "misser", "5.5.5.5");
    const human = humanSideForDate(date);
    const wrong = human === "left" ? "right" : "left";
    const out = await app.guess(claimed.session, wrong, "5.5.5.5");
    expect(out.result.correct).toBe(false);
    expect(out.result.streak).toBe(0);
  });

  it("does not persist anonymous streaks", async () => {
    const { app, store } = makeApp();
    const out = await app.guess(session(), "left", "6.6.6.6");
    expect(out.result.persisted).toBe(false);
    expect(store.players.size).toBe(0);
    expect(store.guesses.size).toBe(0);
  });

  it("continues a streak only on consecutive UTC days", () => {
    const base = {
      current_streak: 3,
      longest_streak: 3,
      last_play_date: "2026-08-16",
      last_result: "correct",
    };
    expect(nextStreak(base, "2026-08-17", true).current).toBe(4);
    expect(nextStreak(base, "2026-08-18", true).current).toBe(1);
    expect(nextStreak({ ...base, last_result: "wrong" }, "2026-08-17", true).current).toBe(1);
    expect(nextStreak(base, "2026-08-17", false).current).toBe(0);
  });

  it("applies an anonymous cut when the same session claims", async () => {
    const date = "2026-08-17";
    const { app } = makeApp({ date });
    const s = session();
    const human = humanSideForDate(date);
    await app.guess(s, human, "7.7.7.7");
    const claimed = await app.claim(s, "lateink", "7.7.7.7");
    const me = await app.me(claimed.session);
    expect(me.username).toBe("lateink");
    expect(me.streak).toBe(1);
    expect(me.guessedToday).toBe(true);
  });
});

describe("pair of the day", () => {
  it("is stable for a UTC date and changes with the date", async () => {
    const sources = [
      source({
        play_date: "2026-08-17",
        id: "a",
        human: "alpha human " + "word ".repeat(90),
        ai: "alpha machine " + "word ".repeat(90),
      }),
      source({
        play_date: "2026-08-18",
        id: "b",
        human: "beta human " + "word ".repeat(90),
        ai: "beta machine " + "word ".repeat(90),
      }),
    ];
    const first = makeApp({ date: "2026-08-17", sources });
    const again = new HumaneApp({
      store: first.store,
      rates: new MemoryRateStore(),
      clock: { now: () => new Date("2026-08-17T23:59:00.000Z") },
      ids: { id: () => "x" },
      sources,
    });
    const a = await first.app.today();
    const b = await again.today();
    expect(a?.left).toBe(b?.left);
    expect(a?.right).toBe(b?.right);
    expect(a?.topic).toBe(b?.topic);

    const nextDay = new HumaneApp({
      store: new MemoryStore(),
      rates: new MemoryRateStore(),
      clock: { now: () => new Date("2026-08-18T00:00:00.000Z") },
      ids: { id: () => "y" },
      sources,
    });
    const c = await nextDay.today();
    expect(c?.left).not.toBe(a?.left);
  });
});
