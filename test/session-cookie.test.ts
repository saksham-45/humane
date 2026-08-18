import { describe, expect, it } from "vitest";
import { decodeSession, defaultSecret } from "../src/lib/session.ts";
import { handleApi, withSessionCookie } from "../src/worker.ts";
import { makeApp, session } from "./helpers.ts";

function cookieValue(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/(?:^|,\s*)humane=([^;]+)/);
  return match ? decodeURIComponent(match[1]!) : null;
}

describe("session cookie after the door", () => {
  it("writes playerId onto the cookie when claim follows an anonymous /api/me", async () => {
    const { app } = makeApp();
    const anon = session();

    const meRes = await handleApi(new Request("http://t/api/me"), new URL("http://t/api/me"), app, anon);
    const afterMe = await withSessionCookie(meRes, anon, defaultSecret(), true, false);
    const meCookie = cookieValue(afterMe.headers.get("Set-Cookie"));
    const issued = await decodeSession(defaultSecret(), meCookie);
    expect(issued?.playerId).toBeNull();

    const claimRes = await handleApi(
      new Request("http://t/api/claim", {
        method: "POST",
        headers: { "content-type": "application/json", "CF-Connecting-IP": "9.9.9.9" },
        body: JSON.stringify({ username: "door_player", avatar: "ink-2" }),
      }),
      new URL("http://t/api/claim"),
      app,
      issued ?? anon,
    );
    expect(claimRes.status).toBe(200);
    expect(claimRes.headers.get("X-Session")).toBeTruthy();

    const afterClaim = await withSessionCookie(claimRes, issued ?? anon, defaultSecret(), false, false);
    const claimCookie = cookieValue(afterClaim.headers.get("Set-Cookie"));
    expect(claimCookie).toBeTruthy();

    const claimed = await decodeSession(defaultSecret(), claimCookie);
    expect(claimed?.playerId).toBeTruthy();

    const meAgain = await handleApi(new Request("http://t/api/me"), new URL("http://t/api/me"), app, claimed!);
    expect(await meAgain.json()).toMatchObject({ username: "door_player", avatar: "ink-2" });
  });

  it("lets a returning player change only the face and keep the name", async () => {
    const { app } = makeApp();
    const first = await app.claim(session(), "keeper", "ink-1", "1.1.1.1");
    const again = await app.claim(first.session, "someone_else", "ink-7", "1.1.1.1");
    expect(again.username).toBe("keeper");
    expect(again.avatar).toBe("ink-7");
    const me = await app.me(first.session);
    expect(me).toMatchObject({ username: "keeper", avatar: "ink-7" });
  });

  it("does not mint a second cookie on a no-op request", async () => {
    const { app } = makeApp();
    const claimed = session("already");
    const meRes = await handleApi(new Request("http://t/api/me"), new URL("http://t/api/me"), app, claimed);
    const next = await withSessionCookie(meRes, claimed, defaultSecret(), false, false);
    expect(next.headers.get("Set-Cookie")).toBeNull();
  });
});
