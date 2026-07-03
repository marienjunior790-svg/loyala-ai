import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr';
import { getSupabaseEnv } from './env';

export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createSSRBrowserClient(url, anonKey);
}
