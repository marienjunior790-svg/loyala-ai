import { timingSafeEqual } from 'node:crypto';

export function verifyWorkerApiAuth(
  headers: Record<string, string | string[] | undefined>
): boolean {
  const secret = process.env.WORKER_API_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }

  const authHeader = headers.authorization;
  const bearer =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;
  const headerSecret =
    typeof headers['x-worker-secret'] === 'string' ? headers['x-worker-secret'] : null;

  const candidate = bearer ?? headerSecret;
  if (!candidate) return false;

  try {
    const a = Buffer.from(candidate);
    const b = Buffer.from(secret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
