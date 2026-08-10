import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeAuthRedirectPath } from '@/lib/auth/safe-redirect';

type EmailOtpType = 'recovery' | 'magiclink' | 'signup' | 'invite' | 'email';

function asEmailOtpType(raw: string | null): EmailOtpType | null {
  if (!raw) return null;
  if (raw === 'recovery' || raw === 'magiclink' || raw === 'signup' || raw === 'invite' || raw === 'email') {
    return raw;
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const otpType = asEmailOtpType(searchParams.get('type'));
  const next = safeAuthRedirectPath(
    searchParams.get('next') ?? (otpType === 'recovery' ? '/reset-password' : null)
  );

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Email links that land with token_hash (OTP) instead of PKCE code
  if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
