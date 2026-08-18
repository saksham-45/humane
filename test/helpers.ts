import { HumaneApp } from "../src/lib/app.ts";
import { MemoryRateStore } from "../src/lib/rate-limit.ts";
import { MemoryStore } from "../src/lib/store.ts";
import type { PairSource } from "../src/types.ts";

export function source(over: Partial<PairSource> & Pick<PairSource, "play_date" | "id">): PairSource {
  return {
    id: over.id,
    topic: over.topic ?? "A borrowed axe",
    human: over.human ?? "human text " + "word ".repeat(90),
    ai: over.ai ?? "ai text " + "model ".repeat(90),
    human_source: over.human_source ?? "Thoreau, Walden. Project Gutenberg.",
    ai_model: over.ai_model ?? "local-draft",
    tell: over.tell ?? "He names the pond.",
    play_date: over.play_date,
    day_index: over.day_index ?? (over.slot ? over.slot - 1 : 0),
    slot: over.slot,
  };
}

export function dayPack(date: string, n = 5): PairSource[] {
  return Array.from({ length: n }, (_, i) =>
    source({
      id: `${date}-${i}`,
      play_date: date,
      day_index: i,
      human: `human ${i + 1} ` + "word ".repeat(90),
      ai: `machine ${i + 1} ` + "word ".repeat(90),
    }),
  );
}

export function makeApp(opts?: { date?: string; sources?: PairSource[]; ipStore?: MemoryRateStore }) {
  const clock = { date: opts?.date ?? "2026-08-17" };
  const store = new MemoryStore();
  const rates = opts?.ipStore ?? new MemoryRateStore();
  let n = 0;
  const app = new HumaneApp({
    store,
    rates,
    clock: { now: () => new Date(`${clock.date}T12:00:00.000Z`) },
    ids: { id: () => `id-${++n}` },
    sources: opts?.sources ?? dayPack(clock.date),
  });
  return { app, store, rates, date: clock.date, clock };
}

export const session = (playerId: string | null = null) => ({ id: "sess-1", playerId });
