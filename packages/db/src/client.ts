import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

/** Browser client — use in Client Components only */
export function createBrowserClient(env: SupabaseEnv): SupabaseClient {
  return createClient(env.url, env.anonKey);
}

/** Server client — pass user access token for RLS */
export function createServerClient(
  env: SupabaseEnv,
  accessToken?: string
): SupabaseClient {
  return createClient(env.url, env.anonKey, {
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Admin client — apps/worker ONLY, never expose to browser (Blueprint T5) */
export function createAdminClient(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
