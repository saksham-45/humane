export interface RateBucket {
  count: number;
  resetAt: number;
}

export interface RateStore {
  get(key: string): Promise<RateBucket | null>;
  put(key: string, value: RateBucket, ttlSec: number): Promise<void>;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export const CLAIM_LIMIT = 10;
export const GUESS_LIMIT = 30;
export const WINDOW_SEC = 3600;

export async function consume(
  store: RateStore,
  key: string,
  limit: number,
  nowMs: number,
  windowSec = WINDOW_SEC,
): Promise<RateLimitResult> {
  const existing = await store.get(key);
  if (!existing || existing.resetAt <= nowMs) {
    const resetAt = nowMs + windowSec * 1000;
    await store.put(key, { count: 1, resetAt }, windowSec);
    return { ok: true, remaining: limit - 1, resetAt };
  }
  if (existing.count >= limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }
  const next = { count: existing.count + 1, resetAt: existing.resetAt };
  const ttl = Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000));
  await store.put(key, next, ttl);
  return { ok: true, remaining: limit - next.count, resetAt: existing.resetAt };
}

export function claimKey(ip: string): string {
  return `rl:claim:${ip}`;
}

export function guessKey(ip: string): string {
  return `rl:guess:${ip}`;
}

export class MemoryRateStore implements RateStore {
  readonly map = new Map<string, RateBucket>();

  async get(key: string): Promise<RateBucket | null> {
    return this.map.get(key) ?? null;
  }

  async put(key: string, value: RateBucket): Promise<void> {
    this.map.set(key, value);
  }
}
