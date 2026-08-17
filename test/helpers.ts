import { HumaneApp } from "../src/lib/app.ts";
import { MemoryRateStore } from "../src/lib/rate-limit.ts";
import { MemoryStore } from "../src/lib/store.ts";
import type { PairSource } from "../src/types.ts";

export function source(over: Partial<PairSource> & Pick<PairSource, "play_date">): PairSource {
  return {
    id: over.id ?? `p-${over.play_date}`,
    topic: over.topic ?? "A borrowed axe",
    human: over.human ?? "human text " + "word ".repeat(90),
    ai: over.ai ?? "ai text " + "model ".repeat(90),
    human_source: over.human_source ?? "Thoreau, Walden. Project Gutenberg.",
    ai_model: over.ai_model ?? "local-draft",
    tell: over.tell ?? "He names the pond.",
    play_date: over.play_date,
  };
}

export function makeApp(opts?: { date?: string; sources?: PairSource[]; ipStore?: MemoryRateStore }) {
  const store = new MemoryStore();
  const rates = opts?.ipStore ?? new MemoryRateStore();
  let n = 0;
  const app = new HumaneApp({
    store,
    rates,
    clock: { now: () => new Date(`${opts?.date ?? "2026-08-17"}T12:00:00.000Z`) },
    ids: { id: () => `id-${++n}` },
    sources: opts?.sources ?? [source({ play_date: opts?.date ?? "2026-08-17" })],
  });
  return { app, store, rates };
}

export const session = (playerId: string | null = null) => ({ id: "sess-1", playerId });
