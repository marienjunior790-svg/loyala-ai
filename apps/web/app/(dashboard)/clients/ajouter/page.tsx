import { requireAuth } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { getWhatsAppConnectionPublic } from '@loyala/domain-crm';
import { NewClientForm } from '../new/new-client-form';

export const dynamic = 'force-dynamic';

export default async function AjouterClientPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const ctx = await requireAuth();
  const { welcome } = await searchParams;
  const showWelcome = welcome === '1';
  const supabase = await createClient();
  const connection = await getWhatsAppConnectionPublic(supabase, ctx.organizationId);

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
      <NewClientForm showWelcome={showWelcome} whatsappReady={connection.isReady} />
    </div>
  );
}
