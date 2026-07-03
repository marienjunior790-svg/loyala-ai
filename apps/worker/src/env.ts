import './load-env.js';
import { parseWorkerEnv, type WorkerEnv } from '@loyala/validation';

let cached: WorkerEnv | null = null;

export function getWorkerEnv(): WorkerEnv {
  if (!cached) {
    cached = parseWorkerEnv(process.env as Record<string, string | undefined>);
  }
  return cached;
}

/** Fail fast at worker boot — call once from index.ts */
export function validateWorkerEnvAtBoot(): WorkerEnv {
  return getWorkerEnv();
}
