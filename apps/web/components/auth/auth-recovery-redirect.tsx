'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Supabase sometimes lands recovery links on Site URL (/) with:
 * - #access_token=…&refresh_token=…&type=recovery
 * - or ?code=… (handled by middleware → /auth/callback)
 * This recovers the session and sends the user to /reset-password.
 */
export function AuthRecoveryRedirect() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (typeof window === 'undefined') return;

      const hash = window.location.hash?.replace(/^#/, '') ?? '';
      const search = window.location.search?.replace(/^\?/, '') ?? '';
      const fromHash = new URLSearchParams(hash);
      const fromSearch = new URLSearchParams(search);

      const type = fromHash.get('type') ?? fromSearch.get('type');
      const accessToken = fromHash.get('access_token');
      const refreshToken = fromHash.get('refresh_token');
      const code = fromSearch.get('code') ?? fromHash.get('code');
      const tokenHash = fromSearch.get('token_hash') ?? fromHash.get('token_hash');

      const isRecovery =
        type === 'recovery' ||
        Boolean(accessToken && refreshToken) ||
        Boolean(tokenHash && type === 'recovery');

      if (!isRecovery && !code && !(accessToken && refreshToken)) return;

      // PKCE code on unexpected path → let callback route finish the exchange
      if (code && !accessToken && window.location.pathname !== '/auth/callback') {
        const next = fromSearch.get('next') || '/reset-password';
        window.location.replace(
          `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`
        );
        return;
      }

      if (!isRecovery && !(accessToken && refreshToken)) return;

      setBusy(true);
      const supabase = createClient();

      try {
        if (tokenHash && (type === 'recovery' || type === 'magiclink' || type === 'email')) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type === 'email' ? 'email' : type === 'magiclink' ? 'magiclink' : 'recovery',
          });
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          return;
        }

        if (cancelled) return;
        // Clear secrets from the address bar
        window.history.replaceState(null, '', '/reset-password');
        router.replace('/reset-password');
      } catch {
        if (!cancelled) {
          window.history.replaceState(null, '', '/login?error=auth_callback');
          router.replace('/login?error=auth_callback');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!busy) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 px-6 text-center">
      <p className="text-sm text-muted-foreground">Ouverture de la réinitialisation…</p>
    </div>
  );
}
