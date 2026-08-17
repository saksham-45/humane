import { describe, expect, it } from "vitest";
import { AlreadyGuessedError, AppError } from "../src/lib/app.ts";
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
    const a = await app.claim(session("s1"), "OakDesk", "1.1.1.1");
    expect(a.username).toBe("oakdesk");
    await expect(app.claim(session("s2"), "oakDESK", "1.1.1.2")).rejects.toMatchObject({
      status: 409,
      code: "taken",
    } satisfies Partial<AppError>);
    const avail = await app.available("OakDesk");
    expect(avail.available).toBe(false);
  });
});

describe("one guess per day", () => {
  it("rejects a second official guess", async () => {
    const { app } = makeApp();
    const claimed = await app.claim(session(), "cutter", "2.2.2.2");
    const first = await app.guess(claimed.session, "left", "2.2.2.2");
    expect(first.result.already).toBeFalsy();
    await expect(app.guess(claimed.session, "right", "2.2.2.2")).rejects.toBeInstanceOf(AlreadyGuessedError);
  });

  it("rejects a second anonymous guess in the same session", async () => {
    const { app } = makeApp();
    const s = session();
    await app.guess(s, "left", "3.3.3.3");
    await expect(app.guess(s, "right", "3.3.3.3")).rejects.toBeInstanceOf(AlreadyGuessedError);
  });
});
