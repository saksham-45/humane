import { describe, expect, it } from "vitest";
import { AppError } from "../src/lib/app.ts";
import { CLAIM_LIMIT, GUESS_LIMIT, MemoryRateStore, claimKey, consume } from "../src/lib/rate-limit.ts";
import { makeApp, session } from "./helpers.ts";

describe("rate limits", () => {
  it("rejects a claim flood from one IP", async () => {
    const { app } = makeApp();
    const ip = "9.9.9.9";
    for (let i = 0; i < CLAIM_LIMIT; i++) {
      await app.claim({ id: `s-${i}`, playerId: null }, `user_${i}`, "ink-0", ip);
    }
    await expect(app.claim(session("overflow"), "user_x", "ink-1", ip)).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
    } satisfies Partial<AppError>);
  });

  it("rejects a guess flood from one player, not the shared IP", async () => {
    const rates = new MemoryRateStore();
    const { app } = makeApp({ ipStore: rates });
    const ip = "8.8.8.8";
    const claimed = await app.claim(session(), "flooder", "ink-2", ip);
    const now = Date.now();
    for (let i = 0; i < GUESS_LIMIT; i++) {
      const ok = await consume(rates, `rl:guess:${claimed.session.playerId}`, GUESS_LIMIT, now);
      expect(ok.ok).toBe(true);
    }
    const first = await app.next(claimed.session);
    if (!("id" in first)) throw new Error("expected a pair");
    await expect(app.guess(claimed.session, first.id, "left", ip)).rejects.toMatchObject({
      status: 429,
    } satisfies Partial<AppError>);
  });

  it("lets two players on the same IP each play their five", async () => {
    const { app } = makeApp();
    const ip = "10.0.0.9";
    const a = await app.claim({ id: "sa", playerId: null }, "alpha_day", "ink-0", ip);
    const b = await app.claim({ id: "sb", playerId: null }, "beta_day", "ink-1", ip);
    for (let i = 0; i < 5; i++) {
      const n = await app.next(a.session);
      if (!("id" in n)) throw new Error("expected a pair");
      await app.guess(a.session, n.id, "left", ip);
    }
    const done = await app.next(a.session);
    expect(done).toMatchObject({ done: true });
    const firstB = await app.next(b.session);
    expect("id" in firstB).toBe(true);
    if (!("id" in firstB)) throw new Error("expected a pair");
    const hit = await app.guess(b.session, firstB.id, "left", ip);
    expect(hit.round).toBe(1);
    expect(hit.of).toBe(5);
  });

  it("opens a new window after expiry", async () => {
    const store = new MemoryRateStore();
    const now = 1_000_000;
    for (let i = 0; i < CLAIM_LIMIT; i++) {
      await consume(store, claimKey("10.0.0.1"), CLAIM_LIMIT, now);
    }
    const blocked = await consume(store, claimKey("10.0.0.1"), CLAIM_LIMIT, now + 10);
    expect(blocked.ok).toBe(false);
    const next = await consume(store, claimKey("10.0.0.1"), CLAIM_LIMIT, now + 3_600_000 + 1);
    expect(next.ok).toBe(true);
  });
});
