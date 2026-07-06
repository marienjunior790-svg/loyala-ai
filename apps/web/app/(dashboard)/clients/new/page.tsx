import { requireAuthPermission } from '@/lib/auth/guard';
import { WelcomeBanner } from '@/components/clients/welcome-banner';
import { NewClientForm } from './new-client-form';

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  await requireAuthPermission('clients:write');
  const { welcome } = await searchParams;
  const showWelcome = welcome === '1';

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
      {showWelcome && <WelcomeBanner />}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Nouveau client</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {showWelcome
            ? 'Commencez par un client fidèle — vous pourrez le relancer tout de suite.'
            : 'Ajoutez un client à votre CRM'}
        </p>
      </div>
      <NewClientForm />
    </div>
  );
}
