import { updateSession } from './lib/supabase/middleware';

export async function middleware(request: import('next/server').NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
};
