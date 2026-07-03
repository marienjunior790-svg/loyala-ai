import type { AILogEntry, AILogSink } from '../types';

export class InMemoryAILogger implements AILogSink {
  readonly entries: AILogEntry[] = [];

  async write(entry: AILogEntry): Promise<void> {
    this.entries.push(entry);
  }

  getTokenStats(organizationId?: string) {
    const filtered = organizationId
      ? this.entries.filter((e) => e.organizationId === organizationId)
      : this.entries;

    return filtered.reduce(
      (acc, e) => ({
        requests: acc.requests + 1,
        inputTokens: acc.inputTokens + e.inputTokens,
        outputTokens: acc.outputTokens + e.outputTokens,
        costUsd: acc.costUsd + e.costUsd,
        cached: acc.cached + (e.cached ? 1 : 0),
      }),
      { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, cached: 0 }
    );
  }
}

export class CompositeAILogger implements AILogSink {
  constructor(private sinks: AILogSink[]) {}

  async write(entry: AILogEntry): Promise<void> {
    await Promise.all(this.sinks.map((s) => s.write(entry)));
  }
}

export class ConsoleAILogger implements AILogSink {
  async write(entry: AILogEntry): Promise<void> {
    const msg =
      `[core-ai] ${entry.useCase} ${entry.provider}/${entry.model} ` +
      `tokens=${entry.inputTokens}+${entry.outputTokens} cost=$${entry.costUsd.toFixed(4)} ` +
      `latency=${entry.latencyMs}ms cached=${entry.cached}`;
    if (!entry.success) console.error(msg, entry.error);
    else console.log(msg);
  }
}

let globalLogger: AILogSink = new CompositeAILogger([new ConsoleAILogger()]);

export function setAILogger(logger: AILogSink): void {
  globalLogger = logger;
}

export function getAILogger(): AILogSink {
  return globalLogger;
}

export async function logAIRequest(entry: AILogEntry): Promise<void> {
  await getAILogger().write(entry);
}

export type { AILogSink };
