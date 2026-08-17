import type { RateBucket, RateStore } from "./rate-limit.ts";

export class KvRateStore implements RateStore {
  constructor(private readonly kv: KVNamespace) {}

  async get(key: string): Promise<RateBucket | null> {
    const raw = await this.kv.get(key, "json");
    if (!raw || typeof raw !== "object") return null;
    const obj = raw as RateBucket;
    if (typeof obj.count !== "number" || typeof obj.resetAt !== "number") return null;
    return obj;
  }

  async put(key: string, value: RateBucket, ttlSec: number): Promise<void> {
    await this.kv.put(key, JSON.stringify(value), { expirationTtl: Math.max(60, ttlSec) });
  }
}
