import { scoreLine, verdictLine } from "../lib/reveal.ts";
import { CutMotion } from "./cut.ts";

type Side = "left" | "right";

interface Today {
  date: string;
  topic: string;
  left: string;
  right: string;
  players: number;
}

interface Me {
  date: string;
  username: string | null;
  streak: number;
  longest: number;
  guessedToday: boolean;
  lastResult: string | null;
}

interface GuessOut {
  correct: boolean;
  humanSide: Side;
  tell: string;
  source: string;
  model: string;
  streak: number | null;
  longest: number | null;
  persisted: boolean;
  already?: boolean;
  error?: string;
  message?: string;
}

const $ = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);

function shareText(date: string, streak: number | null): string {
  const [, m, d] = date.split("-");
  const fire = streak != null && streak > 0 ? ` 🔥${streak}` : "";
  return `HUMANE ${m}.${d}${fire}\n\n▯ ▯\n  ●`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  return (await res.json()) as T;
}

function tally(n: number): string {
  if (n <= 0) return "";
  const fives = Math.floor(n / 5);
  const rest = n % 5;
  return `${"卌".repeat(fives)}${"|".repeat(rest)}`;
}

function boot(): void {
  const page = document.body.dataset.page;
  if (page === "home") void home();
  if (page === "play") void play();
  if (page === "name") void namePage();
  if (page === "board") void board();
}

async function home(): Promise<void> {
  const today = await api<Today & { error?: string }>("/api/today");
  const me = await api<Me>("/api/me");
  const topic = $("#topic");
  const count = $("#count");
  if (topic && today.topic) topic.textContent = today.topic;
  if (count && typeof today.players === "number") {
    count.textContent = today.players === 0 ? "No names claimed yet." : `${today.players} named.`;
  }
  const verb = $("#verb");
  if (verb && me.guessedToday) verb.textContent = "See today's cut";
}

async function play(): Promise<void> {
  const stage = $(".cut-stage") as HTMLElement | null;
  const left = $("[data-side=left] .col-body");
  const right = $("[data-side=right] .col-body");
  const topic = $("#topic");
  const empty = $(".empty") as HTMLElement | null;
  if (!stage || !left || !right) return;

  const today = await api<Today & { error?: string; message?: string }>("/api/today");
  const me = await api<Me>("/api/me");
  if (me.username) document.body.dataset.username = me.username;
  if (today.error) {
    stage.hidden = true;
    if (empty) {
      empty.hidden = false;
      empty.innerHTML = `<h1>The desk is empty.</h1><p>${today.message ?? "No pair for this UTC day."}</p>`;
    }
    return;
  }

  if (topic) topic.textContent = today.topic;
  left.textContent = today.left;
  right.textContent = today.right;
  paintMe(me);

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cutEl = $(".cut") as HTMLElement;
  const motion = new CutMotion({ stage, cut: cutEl, reduced });
  const stackedMq = window.matchMedia("(max-width: 720px)");
  const syncStack = () => {
    stage.dataset.stacked = stackedMq.matches ? "1" : "0";
    motion.setStacked(stackedMq.matches);
  };
  syncStack();
  stackedMq.addEventListener("change", syncStack);

  let inFlight = false;
  let done = me.guessedToday;

  const choose = async (side: Side) => {
    motion.press(side);
    if (done || inFlight) return;
    inFlight = true;
    const out = await api<GuessOut>("/api/guess", {
      method: "POST",
      body: JSON.stringify({ side }),
    });
    inFlight = false;
    if (out.error && out.error !== "already_guessed") {
      showReveal({
        verdict: out.message ?? "The desk jammed.",
      });
      return;
    }
    done = true;
    motion.settle();
    const streak = out.streak ?? 0;
    labelCards(out.humanSide, out.correct, streak);
    showReveal({
      verdict: verdictLine(out.correct),
      tell: out.tell,
      facts: `${out.source} · ${out.model}`,
      streak,
      persisted: !!out.persisted,
      date: today.date,
      already: !!out.already,
    });
    paintMe({ username: me.username, streak, longest: out.longest ?? me.longest });
  };

  for (const btn of stage.querySelectorAll<HTMLButtonElement>(".col")) {
    btn.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      void choose(btn.dataset.side as Side);
    });
  }

  window.addEventListener("keydown", (ev) => {
    if (ev.key === "1" || ev.key === "ArrowLeft") void choose("left");
    if (ev.key === "2" || ev.key === "ArrowRight") void choose("right");
  });

  if (me.guessedToday) {
    const prior = await api<GuessOut>("/api/guess", {
      method: "POST",
      body: JSON.stringify({ side: "left" }),
    });
    if (prior.humanSide) {
      const picked: Side = prior.correct ? prior.humanSide : prior.humanSide === "left" ? "right" : "left";
      motion.press(picked);
      motion.settle();
      labelCards(prior.humanSide, prior.correct, prior.streak ?? me.streak);
      showReveal({
        verdict: verdictLine(prior.correct),
        tell: prior.tell,
        facts: [prior.source && prior.model ? `${prior.source} · ${prior.model}` : "", "One official guess a day."]
          .filter(Boolean)
          .join(" "),
        streak: prior.streak ?? me.streak,
        persisted: prior.persisted,
        date: today.date,
        already: true,
      });
    } else {
      showReveal({
        verdict: "Already cut.",
        tell: "One official guess a day. Tomorrow the paper changes.",
        date: today.date,
        streak: me.streak,
        persisted: !!me.username,
      });
    }
  }
}

function labelCards(humanSide: Side, correct: boolean, streak: number | null): void {
  const score = scoreLine(correct, streak);
  const stage = $(".cut-stage") as HTMLElement | null;
  if (stage) stage.dataset.picked = "1";
  for (const col of document.querySelectorAll<HTMLElement>(".col")) {
    const side = col.dataset.side as Side;
    const human = side === humanSide;
    const result = col.querySelector<HTMLElement>(".col-result");
    const label = col.querySelector<HTMLElement>(".col-label");
    const scoreEl = col.querySelector<HTMLElement>(".col-score");
    if (!result || !label || !scoreEl) continue;
    label.textContent = human ? "Human" : "AI";
    label.dataset.kind = human ? "human" : "ai";
    scoreEl.textContent = score;
    result.hidden = false;
  }
}

function paintMe(me: Pick<Me, "username" | "streak" | "longest">): void {
  const el = $("#who");
  if (!el) return;
  if (!me.username) {
    el.innerHTML = `<a href="/name">Claim a name</a> to keep a streak.`;
    return;
  }
  el.innerHTML = `<span class="tally"><b>${me.username}</b> <i>${tally(me.streak) || "—"}</i> ${me.streak}</span>`;
}

function showReveal(opts: {
  verdict: string;
  tell?: string;
  facts?: string;
  streak?: number;
  persisted?: boolean;
  date?: string;
  already?: boolean;
}): void {
  const box = $(".reveal") as HTMLElement | null;
  if (!box) return;
  box.hidden = false;
  const verdict = $(".verdict");
  const tell = $(".tell");
  const facts = $(".facts");
  if (verdict) verdict.textContent = opts.verdict;
  if (tell) tell.textContent = opts.tell ?? "";
  if (facts) {
    const bits = [opts.facts, opts.persisted === false ? "Local only until you claim a name." : ""].filter(Boolean);
    facts.textContent = bits.join(" ");
  }
  const shareBtn = $("#share");
  const card = $("#card") as HTMLImageElement | null;
  if (shareBtn && opts.date) {
    const text = shareText(opts.date, opts.streak ?? null);
    shareBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
        shareBtn.textContent = "Copied.";
      } catch {
        shareBtn.textContent = "Copy failed.";
      }
    });
  }
  if (card && opts.date) {
    const who = document.body.dataset.username || "player";
    card.src = `/og/${opts.date}/${who}.png?s=${opts.streak ?? 0}`;
    card.hidden = false;
  }
}

async function namePage(): Promise<void> {
  const input = $("#username") as HTMLInputElement | null;
  const status = $("#status");
  const form = $("#claim");
  if (!input || !status || !form) return;
  let t = 0;
  input.addEventListener("input", () => {
    window.clearTimeout(t);
    const v = input.value;
    t = window.setTimeout(async () => {
      if (v.trim().length < 3) {
        status.textContent = "Three to sixteen. Letters, numbers, underscore.";
        return;
      }
      const out = await api<{ available: boolean; reason?: string }>(
        `/api/available?username=${encodeURIComponent(v)}`,
      );
      status.textContent = out.available ? "Open." : out.reason ?? "Taken.";
    }, 220);
  });
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const out = await api<{ username?: string; message?: string; error?: string }>("/api/claim", {
      method: "POST",
      body: JSON.stringify({ username: input.value }),
    });
    if (out.username) {
      const next = new URLSearchParams(location.search).get("next") || "/play";
      location.href = next;
      return;
    }
    status.textContent = out.message ?? "That name did not take.";
  });
}

async function board(): Promise<void> {
  const table = $("#rows");
  const empty = $(".empty") as HTMLElement | null;
  const you = $("#you") as HTMLElement | null;
  const key = "humane:board:cache";
  type BoardPayload = {
    at: number;
    rows: Array<{ rank: number; username: string; current: number; longest: number; you?: boolean }>;
    you: { rank: number; username: string; current: number; longest: number } | null;
  };
  let data: BoardPayload | null = null;
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      const parsed = JSON.parse(cached) as BoardPayload;
      if (Date.now() - parsed.at < 60_000) data = parsed;
    }
  } catch {
    data = null;
  }
  if (!data) {
    const fresh = await api<Omit<BoardPayload, "at">>("/api/board");
    data = { ...fresh, at: Date.now() };
    sessionStorage.setItem(key, JSON.stringify(data));
  }
  if (!table) return;
  if (!data.rows.length) {
    if (empty) empty.hidden = false;
    table.parentElement?.setAttribute("hidden", "");
    return;
  }
  table.innerHTML = data.rows
    .map(
      (r) =>
        `<tr class="${r.you ? "you" : ""}"><td>${r.rank}</td><td>${esc(r.username)}</td><td>${r.current}</td><td>${r.longest}</td></tr>`,
    )
    .join("");
  if (you && data.you && data.you.rank > 50) {
    you.hidden = false;
    you.textContent = `${data.you.rank}  ${data.you.username}  now ${data.you.current}  best ${data.you.longest}`;
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

boot();
