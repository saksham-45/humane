import { describe, expect, it } from "vitest";
import { AppError } from "../src/lib/app.ts";
import { CLAIM_LIMIT, GUESS_LIMIT, MemoryRateStore, claimKey, consume } from "../src/lib/rate-limit.ts";
import { makeApp, session } from "./helpers.ts";

describe("rate limits", () => {
  it("rejects a claim flood from one IP", async () => {
    const { app } = makeApp();
    const ip = "9.9.9.9";
    for (let i = 0; i < CLAIM_LIMIT; i++) {
      await app.claim(session(`s-${i}`), `user_${i}`, ip);
    }
    await expect(app.claim(session("overflow"), "user_x", ip)).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
    } satisfies Partial<AppError>);
  });

  it("rejects a guess flood from one IP", async () => {
    const rates = new MemoryRateStore();
    const { app } = makeApp({ ipStore: rates });
    const ip = "8.8.8.8";
    const now = Date.now();
    for (let i = 0; i < GUESS_LIMIT; i++) {
      const ok = await consume(rates, `rl:guess:${ip}`, GUESS_LIMIT, now);
      expect(ok.ok).toBe(true);
    }
    await expect(app.guess(session(), "left", ip)).rejects.toMatchObject({
      status: 429,
    } satisfies Partial<AppError>);
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
