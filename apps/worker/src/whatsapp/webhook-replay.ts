/** In-memory dedupe window for Meta webhook retries / replay (per worker instance). */
const REPLAY_TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 10_000;

const seen = new Map<string, number>();

export function buildWebhookDedupeKey(
  wamid: string,
  status: string,
  timestamp?: string
): string {
  return `${wamid}:${status}:${timestamp ?? 'na'}`;
}

export function isReplayedWebhook(key: string, now = Date.now()): boolean {
  pruneExpired(now);
  const expiresAt = seen.get(key);
  return expiresAt !== undefined && expiresAt > now;
}

export function markWebhookProcessed(key: string, now = Date.now()): void {
  pruneExpired(now);
  if (seen.size >= MAX_ENTRIES) {
    const oldest = seen.keys().next().value;
    if (oldest) seen.delete(oldest);
  }
  seen.set(key, now + REPLAY_TTL_MS);
}

function pruneExpired(now: number): void {
  for (const [key, expiresAt] of seen) {
    if (expiresAt <= now) seen.delete(key);
  }
}

/** Test helper */
export function clearWebhookReplayCache(): void {
  seen.clear();
}
