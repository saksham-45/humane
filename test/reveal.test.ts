import { describe, expect, it } from "vitest";
import { scoreLine, verdictLine } from "../src/lib/reveal.ts";

describe("reveal copy", () => {
  it("labels a hit as Streak N and a miss as Streak reset", () => {
    expect(scoreLine(true, 12)).toBe("Streak 12");
    expect(scoreLine(true, 1)).toBe("Streak 1");
    expect(scoreLine(false, 0)).toBe("Streak reset");
    expect(scoreLine(false, null)).toBe("Streak reset");
  });

  it("says who wrote the pick in plain English", () => {
    expect(verdictLine(true)).toBe("You found the human.");
    expect(verdictLine(false)).toBe("That one was written by a machine.");
    expect(verdictLine(true)).not.toMatch(/blood|signal/i);
    expect(verdictLine(false)).not.toMatch(/blood|signal/i);
  });
});
