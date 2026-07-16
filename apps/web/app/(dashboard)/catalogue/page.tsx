import { requireAuthPermission } from '@/lib/auth/guard';
import { canWriteClients } from '@/lib/auth/clients-access';
import { createClient } from '@/lib/supabase/server';
import { listCatalogCategories, listCatalogItems } from '@loyala/domain-crm';
import { Card, CardContent } from '@/components/ui/card';
import { ModuleError } from '@/components/dashboard/module-error';
import { CatalogClient } from '@/components/catalogue/catalog-client';

export const dynamic = 'force-dynamic';

export default async function CataloguePage() {
  const ctx = await requireAuthPermission('clients:read');
  const canWrite = canWriteClients(ctx);
  const supabase = await createClient();

  let categories: Awaited<ReturnType<typeof listCatalogCategories>> = [];
  let items: Awaited<ReturnType<typeof listCatalogItems>> = [];
  let error: string | null = null;

  try {
    [categories, items] = await Promise.all([
      listCatalogCategories(supabase, ctx.organizationId),
      listCatalogItems(supabase, ctx.organizationId),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Impossible de charger le catalogue';
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Catalogue</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tout ce que votre établissement vend ou loue — produits, services, catégories
        </p>
      </div>

      {error ? (
        <ModuleError message={error} />
      ) : (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <CatalogClient categories={categories} items={items} canWrite={canWrite} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
