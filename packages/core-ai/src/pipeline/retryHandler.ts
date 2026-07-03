export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const DEFAULT_SHOULD_RETRY = (error: unknown): boolean => {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('rate') ||
      msg.includes('timeout') ||
      msg.includes('503') ||
      msg.includes('502') ||
      msg.includes('429') ||
      msg.includes('overloaded')
    );
  }
  return false;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 200
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i >= attempts - 1) break;
      await wait(2 ** i * baseDelayMs);
    }
  }

  throw lastError;
}

/** Configurable retry with predicate */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    shouldRetry = DEFAULT_SHOULD_RETRY,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error, attempt)) throw error;
      await wait(baseDelayMs * Math.pow(2, attempt - 1));
    }
  }

  throw lastError;
}

export function isRetryable(error: unknown): boolean {
  return DEFAULT_SHOULD_RETRY(error);
}
