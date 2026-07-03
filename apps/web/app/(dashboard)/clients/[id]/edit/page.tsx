import { notFound } from 'next/navigation';
import { requireAuthPermission } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import { getClient } from '@loyala/domain-crm';
import { EditClientForm } from './edit-client-form';

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAuthPermission('clients:write');

  const supabase = await createClient();
  const client = await getClient(supabase, ctx.organizationId, id);

  if (!client) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Modifier le client</h2>
        <p className="mt-1 text-sm text-muted-foreground">{client.full_name}</p>
      </div>
      <EditClientForm client={client} />
    </div>
  );
}
