import { describe, expect, it } from "vitest";
import { AppError } from "../src/lib/app.ts";
import { COMMENT_LIMIT, MemoryRateStore, consume } from "../src/lib/rate-limit.ts";
import { handleApi } from "../src/worker.ts";
import { makeApp, session } from "./helpers.ts";

describe("board notes", () => {
  it("rejects a note before a name", async () => {
    const { app } = makeApp();
    await expect(app.postComment(session(), "hello table", "1.1.1.1")).rejects.toMatchObject({
      status: 401,
      code: "need_name",
    } satisfies Partial<AppError>);
  });

  it("rejects empty and overlong notes", async () => {
    const { app } = makeApp();
    const claimed = await app.claim(session(), "noter", "ink-4", "3.3.3.3");
    await expect(app.postComment(claimed.session, "   ", "3.3.3.3")).rejects.toMatchObject({
      status: 400,
      code: "empty",
    } satisfies Partial<AppError>);
    await expect(app.postComment(claimed.session, "x".repeat(161), "3.3.3.3")).rejects.toMatchObject({
      status: 400,
      code: "too_long",
    } satisfies Partial<AppError>);
  });

  it("posts a note and lists newest first", async () => {
    const { app } = makeApp();
    const claimed = await app.claim(session(), "noter", "ink-4", "2.2.2.2");
    const first = await app.postComment(claimed.session, "  first mark  ", "2.2.2.2");
    expect(first).toMatchObject({
      username: "noter",
      avatar: "ink-4",
      body: "first mark",
    });
    const second = await app.postComment(claimed.session, "later", "2.2.2.2");
    const list = await app.comments();
    expect(list.map((row) => row.body)).toEqual(["later", "first mark"]);
    expect(list[0]?.id).toBe(second.id);
  });

  it("serves comments over the api", async () => {
    const { app } = makeApp();
    const claimed = await app.claim(session(), "wire", "ink-1", "7.7.7.7");
    await app.postComment(claimed.session, "from the board", "7.7.7.7");
    const listed = await handleApi(
      new Request("http://humane.test/api/comments"),
      new URL("http://humane.test/api/comments"),
      app,
      claimed.session,
    );
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as { comments: Array<{ body: string }> };
    expect(body.comments[0]?.body).toBe("from the board");

    const posted = await handleApi(
      new Request("http://humane.test/api/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "second" }),
      }),
      new URL("http://humane.test/api/comments"),
      app,
      claimed.session,
    );
    expect(posted.status).toBe(200);
    const note = (await posted.json()) as { body: string; username: string };
    expect(note).toMatchObject({ body: "second", username: "wire" });
  });

  it("rate limits notes from one IP", async () => {
    const rates = new MemoryRateStore();
    const { app } = makeApp({ ipStore: rates });
    const claimed = await app.claim(session(), "flood", "ink-2", "4.4.4.4");
    const now = Date.now();
    for (let i = 0; i < COMMENT_LIMIT; i++) {
      const ok = await consume(rates, `rl:comment:9.9.9.9`, COMMENT_LIMIT, now);
      expect(ok.ok).toBe(true);
    }
    await expect(app.postComment(claimed.session, "too many", "9.9.9.9")).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
    } satisfies Partial<AppError>);
  });
});
