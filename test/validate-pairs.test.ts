import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { packsByDate, pickSourcesForDate } from "../src/lib/pairs.ts";
import pairsJson from "../content/pairs.json";

describe("pairs", () => {
  it("passes the official validator", () => {
    const out = execFileSync("node", ["scripts/validate-pairs.mjs"], { encoding: "utf8" });
    expect(out).toMatch(/ok: \d+ pairs/);
  });

  it("groups the thirty pairs into UTC days of five", () => {
    const sources = pairsJson.pairs;
    expect(sources.length).toBeGreaterThanOrEqual(30);
    const packs = packsByDate(sources);
    expect(packs.size).toBeGreaterThanOrEqual(6);
    for (const [date, pack] of packs) {
      expect(pack, date).toHaveLength(5);
      expect(pack.map((p) => p.day_index ?? (p.slot ?? 1) - 1).sort()).toEqual([0, 1, 2, 3, 4]);
    }
    const first = [...packs.keys()].sort()[0];
    expect(pickSourcesForDate(sources, first)).toHaveLength(5);
  });
});
