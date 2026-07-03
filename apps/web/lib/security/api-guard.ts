import { NextResponse } from 'next/server';
import { checkRateLimit, rateLimitHeaders } from './rate-limit';

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/** Apply rate limit to API route handlers. */
export async function withRateLimit(
  request: Request,
  handler: () => Promise<NextResponse>,
  keyPrefix = 'api'
): Promise<NextResponse> {
  const ip = getClientIp(request);
  const path = new URL(request.url).pathname;
  const result = await checkRateLimit(`${keyPrefix}:${ip}:${path}`);

  if (!result.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders(result),
          'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  const response = await handler();
  for (const [k, v] of Object.entries(rateLimitHeaders(result))) {
    response.headers.set(k, v);
  }
  return response;
}

/** Verify internal worker → web calls (optional). */
export function verifyInternalApiSecret(request: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}
