export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLog {
  level: LogLevel;
  service: string;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export function logStructured(entry: Omit<StructuredLog, 'timestamp'>): void {
  const payload: StructuredLog = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  const line = JSON.stringify(payload);
  if (entry.level === 'error') console.error(line);
  else if (entry.level === 'warn') console.warn(line);
  else console.log(line);
}

/** Optional Better Stack heartbeat (BETTERSTACK_HEARTBEAT_URL). */
export async function pingHeartbeat(name: string): Promise<void> {
  const url = process.env.BETTERSTACK_HEARTBEAT_URL;
  if (!url) return;

  try {
    await fetch(url, { method: 'POST', signal: AbortSignal.timeout(5000) });
  } catch (error) {
    logStructured({
      level: 'warn',
      service: name,
      message: 'Heartbeat ping failed',
      context: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}
