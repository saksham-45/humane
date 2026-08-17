import { describe, expect, it } from "vitest";
import { CUT_SETTLE, CUT_TRAVEL, cutShift } from "../src/lib/cut-layout.ts";

describe("cut layout", () => {
  it("settles on the center with no shift", () => {
    expect(CUT_SETTLE).toBe(0);
    expect(cutShift(CUT_SETTLE)).toBe(0);
  });

  it("only leaves the gutter by a short press travel", () => {
    expect(Math.abs(cutShift(-1))).toBe(CUT_TRAVEL);
    expect(CUT_TRAVEL).toBeLessThanOrEqual(36);
  });
});
