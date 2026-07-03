import { createHash } from 'node:crypto';
import type { AIResponse } from '../types';

interface CacheEntry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, CacheEntry<AIResponse>>();

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function buildCacheKey(
  tenantId: string,
  promptKey: string,
  variables: Record<string, unknown>
): string {
  return `${tenantId}:${promptKey}:${JSON.stringify(variables)}`;
}

export function getCachedResponse(key: string): AIResponse | null {
  const item = store.get(hashKey(key));
  if (!item) return null;

  if (Date.now() > item.expires) {
    store.delete(hashKey(key));
    return null;
  }

  return item.value;
}

export function setCache(key: string, value: AIResponse, ttlMs = 60 * 60 * 1000): void {
  store.set(hashKey(key), {
    value,
    expires: Date.now() + ttlMs,
  });
}

export function clearCache(): void {
  store.clear();
}

/** Structured cache for legacy keyed objects */
export class IntelligentCache<T> {
  private inner = new Map<string, CacheEntry<T>>();

  constructor(private defaultTtlSeconds: number) {}

  private key(parts: Record<string, unknown>): string {
    return hashKey(JSON.stringify(parts));
  }

  get(parts: Record<string, unknown>): T | null {
    const k = this.key(parts);
    const entry = this.inner.get(k);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.inner.delete(k);
      return null;
    }
    return entry.value;
  }

  set(parts: Record<string, unknown>, value: T, ttlSeconds?: number): void {
    const ttl = (ttlSeconds ?? this.defaultTtlSeconds) * 1000;
    this.inner.set(this.key(parts), { value, expires: Date.now() + ttl });
  }

  clear(): void {
    this.inner.clear();
  }

  size(): number {
    return this.inner.size;
  }
}
