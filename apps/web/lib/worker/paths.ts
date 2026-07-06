/** AI sub-paths exposed by the worker — mirrored in apps/worker/src/index.ts */
export const WORKER_AI_PATHS = [
  'stats',
  'segment',
  'inactive/detect',
  'inactive/analyze',
  'campaigns/birthday',
  'campaigns/loyalty',
  'campaigns/promotions',
  'inbox/reply',
  'inbox/classify',
  'rfm/score',
] as const;

export type WorkerAiPath = (typeof WORKER_AI_PATHS)[number];

const ALLOWED = new Set<string>(WORKER_AI_PATHS);

export function isAllowedAiPath(path: string): path is WorkerAiPath {
  return ALLOWED.has(path);
}

export function toWorkerAiPath(subPath: string): string {
  return `/ai/${subPath}`;
}
