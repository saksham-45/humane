import { describe, expect, it } from "vitest";
import { shareText } from "../src/lib/share.ts";
import { renderOgPng } from "../src/og/png.ts";

describe("share card", () => {
  it("copies a non-spoiling grid", () => {
    const text = shareText("2026-08-17", 12);
    expect(text).toContain("HUMANE 08.17");
    expect(text).toContain("🔥12");
    expect(text).toContain("▯ ▯");
    expect(text).not.toMatch(/\b(left|right|human|signal)\b/i);
    expect(text).not.toContain("http");
  });

  it("renders a 1200×630 PNG", async () => {
    const png = await renderOgPng({
      dateStamp: "08.17",
      username: "oak",
      streak: 12,
      origin: "https://humane.pages.dev",
    });
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
    expect(png.byteLength).toBeGreaterThan(800);
  });
});
