import { daysBetween } from "./date.ts";
import type { PairSource, PublicPair, Side } from "../types.ts";

export const ROUNDS = 5;

export function dayIndexOf(source: PairSource): number {
  if (typeof source.day_index === "number") return source.day_index;
  if (typeof source.slot === "number") return source.slot - 1;
  return 0;
}

export function humanSideForId(id: string): Side {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  }
  return (h & 1) === 0 ? "left" : "right";
}

export function layoutPair(source: PairSource): {
  left_text: string;
  right_text: string;
  human_side: Side;
} {
  const human_side = humanSideForId(source.id);
  if (human_side === "left") {
    return { left_text: source.human, right_text: source.ai, human_side };
  }
  return { left_text: source.ai, right_text: source.human, human_side };
}

export function toPublic(pair: { id: string; topic: string; left_text: string; right_text: string }): PublicPair {
  return {
    id: pair.id,
    topic: pair.topic,
    left: pair.left_text,
    right: pair.right_text,
  };
}

export function packsByDate(sources: PairSource[]): Map<string, PairSource[]> {
  const packs = new Map<string, PairSource[]>();
  for (const src of sources) {
    const list = packs.get(src.play_date) ?? [];
    list.push(src);
    packs.set(src.play_date, list);
  }
  for (const list of packs.values()) {
    list.sort((a, b) => dayIndexOf(a) - dayIndexOf(b));
  }
  return packs;
}

/** Five pairs for a UTC day. Exact play_date wins; otherwise cycle the day groups. */
export function pickSourcesForDate(sources: PairSource[], date: string): PairSource[] {
  const packs = packsByDate(sources);
  const exact = packs.get(date);
  if (exact?.length) return exact.slice(0, ROUNDS);
  const dates = [...packs.keys()].sort();
  if (!dates.length) return [];
  const offset = daysBetween(dates[0], date);
  const idx = ((offset % dates.length) + dates.length) % dates.length;
  return (packs.get(dates[idx]) ?? []).slice(0, ROUNDS);
}

const LABEL_KEYS = [
  "humanSide",
  "human_side",
  "tell",
  "source",
  "model",
  "ai_model",
  "human_source",
  "correct",
];

export function assertNoLabels(payload: unknown): void {
  if (!payload || typeof payload !== "object") return;
  const obj = payload as Record<string, unknown>;
  for (const key of LABEL_KEYS) {
    if (key in obj) {
      throw new Error(`public payload leaked label field: ${key}`);
    }
  }
}
