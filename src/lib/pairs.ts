import type { PairSource, Side } from "../types.ts";

export function humanSideForDate(date: string): Side {
  let h = 0;
  for (let i = 0; i < date.length; i++) {
    h = (Math.imul(h, 31) + date.charCodeAt(i)) | 0;
  }
  return (h & 1) === 0 ? "left" : "right";
}

export function layoutPair(source: PairSource): {
  left_text: string;
  right_text: string;
  human_side: Side;
} {
  const human_side = humanSideForDate(source.play_date);
  if (human_side === "left") {
    return { left_text: source.human, right_text: source.ai, human_side };
  }
  return { left_text: source.ai, right_text: source.human, human_side };
}

export function publicPair(pair: {
  play_date: string;
  topic: string;
  left_text: string;
  right_text: string;
}): { date: string; topic: string; left: string; right: string } {
  return {
    date: pair.play_date,
    topic: pair.topic,
    left: pair.left_text,
    right: pair.right_text,
  };
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
