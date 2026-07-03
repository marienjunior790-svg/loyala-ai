import type { AILogEntry, AILogSink } from '../types';

export interface SupabaseAdminLike {
  from(table: string): {
    insert(row: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
  };
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

export class SupabaseAILogger implements AILogSink {
  constructor(private readonly admin: SupabaseAdminLike) {}

  async write(entry: AILogEntry): Promise<void> {
    const { error } = await this.admin.from('ai_request_logs').insert({
      request_id: entry.requestId,
      organization_id: entry.organizationId,
      use_case: entry.useCase,
      provider: entry.provider,
      model: entry.model,
      input_tokens: entry.inputTokens,
      output_tokens: entry.outputTokens,
      cost_usd: entry.costUsd,
      latency_ms: entry.latencyMs,
      cached: entry.cached,
      success: entry.success,
      error_message: entry.error ?? null,
      created_at: entry.createdAt,
    });

    if (error) {
      console.error('[core-ai] SupabaseAILogger:', error.message);
    }
  }
}
