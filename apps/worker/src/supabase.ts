import { createAdminClient } from '@loyala/db';
import { getWorkerEnv } from './env.js';

let adminClient: ReturnType<typeof createAdminClient> | null = null;

export function getWorkerAdminClient() {
  if (!adminClient) {
    const env = getWorkerEnv();
    adminClient = createAdminClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return adminClient;
}
