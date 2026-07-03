/**
 * Concurrent batch processor — limits parallel LLM calls per tenant.
 */
export interface BatchOptions {
  concurrency?: number;
  onItemError?: (error: unknown, index: number) => void;
}

export async function processBatch<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: BatchOptions = {}
): Promise<R[]> {
  const { concurrency = 5, onItemError } = options;
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index]!;
      try {
        results[index] = await processor(item, index);
      } catch (error) {
        onItemError?.(error, index);
        throw error;
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

/** Fire-and-forget batch — collects successes and failures */
export async function processBatchSafe<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency = 5
): Promise<{ successes: R[]; failures: { index: number; error: string }[] }> {
  const successes: R[] = [];
  const failures: { index: number; error: string }[] = [];

  await processBatch(
    items,
    async (item, index) => {
      try {
        const result = await processor(item);
        successes.push(result);
        return result;
      } catch (error) {
        failures.push({
          index,
          error: error instanceof Error ? error.message : String(error),
        });
        return null as R;
      }
    },
    { concurrency }
  );

  return { successes, failures };
}
