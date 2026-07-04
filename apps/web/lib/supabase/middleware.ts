import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { ORG_COOKIE_NAME } from '@loyala/core-iam';
import { getActiveMembership } from '@/lib/auth/membership';

type CookieToSet = {
  name: string;
  value: string;
  options?: {
    domain?: string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    sameSite?: 'lax' | 'strict' | 'none' | boolean;
    secure?: boolean;
  };
};
const GUEST_ONLY_PATHS = ['/login', '/signup', '/forgot-password'];
const ONBOARDING_PATH = '/onboarding';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isGuestOnly = GUEST_ONLY_PATHS.some((p) => pathname.startsWith(p));
  const isOnboarding = pathname.startsWith(ONBOARDING_PATH);
  const isCallback = pathname.startsWith('/auth/callback');
  const isRecovery = pathname.startsWith('/reset-password');

  if (!user && !isGuestOnly && !isCallback) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  if (user && isGuestOnly) {
    const dest = request.nextUrl.clone();
    dest.pathname = ONBOARDING_PATH;
    const membership = await getActiveMembership(supabase);
    if (membership) dest.pathname = '/dashboard';
    return NextResponse.redirect(dest);
  }

  if (user && isOnboarding) {
    const membership = await getActiveMembership(supabase);
    if (membership) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = '/dashboard';
      const response = NextResponse.redirect(dashboardUrl);
      const orgCookie = request.cookies.get(ORG_COOKIE_NAME)?.value;
      if (!orgCookie) {
        response.cookies.set(ORG_COOKIE_NAME, membership.organization_id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
        });
      }
      return response;
    }
  }

  if (user && !isGuestOnly && !isOnboarding && !isCallback && !isRecovery) {
    const membership = await getActiveMembership(supabase);

    if (!membership) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = ONBOARDING_PATH;
      return NextResponse.redirect(onboardingUrl);
    }

    const orgCookie = request.cookies.get(ORG_COOKIE_NAME)?.value;
    if (!orgCookie) {
      supabaseResponse.cookies.set(ORG_COOKIE_NAME, membership.organization_id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }
  }

  return supabaseResponse;
}
