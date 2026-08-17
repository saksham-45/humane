import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("pairs", () => {
  it("passes the official validator", () => {
    const out = execFileSync("node", ["scripts/validate-pairs.mjs"], { encoding: "utf8" });
    expect(out).toMatch(/ok: \d+ pairs/);
  });
});
