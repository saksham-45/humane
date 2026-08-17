import { describe, expect, it } from "vitest";
import { Spring } from "../src/client/spring.ts";

describe("cut spring", () => {
  it("is critically damped: settles near 0.4s without overshoot on a tap", () => {
    const s = new Spring(0, 0.4, 1);
    s.setTarget(-1);
    let min = 0;
    for (let i = 0; i < 48; i++) {
      s.step(1 / 60);
      if (s.x < min) min = s.x;
    }
    expect(s.x).toBeLessThan(-0.95);
    expect(s.settled).toBe(true);
    expect(min).toBeGreaterThan(-1.02);
  });

  it("retargets from the live value with leftover velocity", () => {
    const s = new Spring(0, 0.4, 1);
    s.setTarget(-1);
    for (let i = 0; i < 6; i++) s.step(1 / 60);
    const mid = s.x;
    const vel = s.v;
    expect(mid).toBeLessThan(0);
    expect(vel).not.toBe(0);
    s.setTarget(1);
    s.step(1 / 60);
    expect(s.x).not.toBe(0);
    expect(s.x).not.toBe(-1);
  });
});
