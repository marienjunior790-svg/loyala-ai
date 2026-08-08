import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import {
  getLoyaltySummary,
  listClients,
  listLoyaltyTransactions,
} from '@loyala/domain-crm';
import { LoyaltyPageClient } from '@/components/loyalty/loyalty-page-client';
import { ModuleError } from '@/components/dashboard/module-error';

export const dynamic = 'force-dynamic';

export default async function LoyaltyPage() {
  const ctx = await requireAuth();
  const supabase = await createClient();

  try {
    const [summary, clients, transactions] = await Promise.all([
      getLoyaltySummary(supabase, ctx.organizationId),
      listClients(supabase, ctx.organizationId),
      listLoyaltyTransactions(supabase, ctx.organizationId, 40),
    ]);

    return (
      <LoyaltyPageClient
        summary={summary}
        clients={clients.map((c) => ({
          id: c.id,
          full_name: c.full_name,
          loyalty_points: c.loyalty_points,
        }))}
        transactions={transactions}
      />
    );
  } catch (e) {
    return (
      <ModuleError message={e instanceof Error ? e.message : 'Erreur chargement fidélité'} />
    );
  }
}
