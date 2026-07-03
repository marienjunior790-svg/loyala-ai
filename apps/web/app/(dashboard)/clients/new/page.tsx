import { requireAuthPermission } from '@/lib/auth/guard';
import { NewClientForm } from './new-client-form';

export default async function NewClientPage() {
  await requireAuthPermission('clients:write');

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Nouveau client</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ajoutez un client à votre CRM</p>
      </div>
      <NewClientForm />
    </div>
  );
}
