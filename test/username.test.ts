import { describe, expect, it } from "vitest";
import { AppError } from "../src/lib/app.ts";
import { checkUsername } from "../src/lib/username.ts";
import { makeApp, session } from "./helpers.ts";

describe("username", () => {
  it("accepts 3–16 [a-z0-9_] and rejects the rest", () => {
    expect(checkUsername("ab").error).toBe("too_short");
    expect(checkUsername("abcdefghijklmnopq").error).toBe("too_long");
    expect(checkUsername("Bad Name").error).toBe("bad_chars");
    expect(checkUsername("admin").error).toBe("reserved");
    expect(checkUsername("HUMANE").error).toBe("reserved");
    expect(checkUsername("Ink_12").ok).toBe(true);
    expect(checkUsername("Ink_12").norm).toBe("ink_12");
  });

  it("is case-insensitive unique and first write wins", async () => {
    const { app } = makeApp();
    const a = await app.claim(session("s1"), "OakDesk", "ink-0", "1.1.1.1");
    expect(a.username).toBe("oakdesk");
    await expect(app.claim(session("s2"), "oakDESK", "ink-1", "1.1.1.2")).rejects.toMatchObject({
      status: 409,
      code: "taken",
    } satisfies Partial<AppError>);
  });
});
