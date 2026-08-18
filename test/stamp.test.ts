import { describe, expect, it } from "vitest";
import { playStampHit, stampForPick } from "../src/client/sweep.ts";

describe("rubber stamp on the pick", () => {
  it("stamps HUMAN when the chosen card is the human", () => {
    expect(stampForPick("left", "left")).toBe("HUMAN");
    expect(stampForPick("right", "right")).toBe("HUMAN");
  });

  it("stamps AI when the chosen card is the machine", () => {
    expect(stampForPick("left", "right")).toBe("AI");
    expect(stampForPick("right", "left")).toBe("AI");
  });

  it("does not throw when playing the hit with no window audio", () => {
    expect(() => playStampHit()).not.toThrow();
  });
});
