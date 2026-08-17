import { formatStamp } from "./date.ts";

export function shareText(date: string, streak: number | null): string {
  const fire = streak != null && streak > 0 ? ` 🔥${streak}` : "";
  return `HUMANE ${formatStamp(date)}${fire}\n\n▯ ▯\n  ●`;
}

export function shareCacheKey(date: string, username: string, streak: number): string {
  return `og:${date}:${username.toLowerCase()}:${streak}`;
}
