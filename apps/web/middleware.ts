import { updateSession } from './lib/supabase/middleware';

export async function middleware(request: import('next/server').NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|robots.txt|sitemap.xml|api/|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico)$).*)',
  ],
};
