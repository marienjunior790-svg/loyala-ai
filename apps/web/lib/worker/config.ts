export interface WorkerConfig {
  baseUrl: string;
  secret: string;
}

/** Returns worker connection config when WORKER_URL is set. */
export function getWorkerConfig(): WorkerConfig | null {
  const raw = process.env.WORKER_URL?.trim();
  if (!raw) return null;

  const baseUrl = raw.replace(/\/$/, '');
  const secret = process.env.WORKER_API_SECRET ?? '';

  if (process.env.NODE_ENV === 'production' && secret.length < 16) {
    return null;
  }

  return { baseUrl, secret };
}

export function isWorkerConfigured(): boolean {
  return getWorkerConfig() !== null;
}
