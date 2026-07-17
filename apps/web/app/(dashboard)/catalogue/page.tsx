import { requireAuthPermission } from '@/lib/auth/guard';
import { canWriteClients } from '@/lib/auth/clients-access';
import { createClient } from '@/lib/supabase/server';
import {
  listCatalogCategories,
  listCatalogItems,
  getCatalogSettings,
  listCatalogVersions,
  type CatalogSettings,
  type CatalogVersion,
} from '@loyala/domain-crm';
import { Card, CardContent } from '@/components/ui/card';
import { ModuleError } from '@/components/dashboard/module-error';
import { CatalogClient } from '@/components/catalogue/catalog-client';

export const dynamic = 'force-dynamic';

const FALLBACK_SETTINGS = (organizationId: string): CatalogSettings => ({
  organization_id: organizationId,
  publication_status: 'draft',
  published_at: null,
  published_version_id: null,
  default_locale: 'fr',
  locales: ['fr'],
  public_slug: null,
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export default async function CataloguePage() {
  const ctx = await requireAuthPermission('clients:read');
  const canWrite = canWriteClients(ctx);
  const supabase = await createClient();

  let categories: Awaited<ReturnType<typeof listCatalogCategories>> = [];
  let items: Awaited<ReturnType<typeof listCatalogItems>> = [];
  let settings: CatalogSettings = FALLBACK_SETTINGS(ctx.organizationId);
  let versions: CatalogVersion[] = [];
  let error: string | null = null;

  try {
    [categories, items] = await Promise.all([
      listCatalogCategories(supabase, ctx.organizationId),
      listCatalogItems(supabase, ctx.organizationId),
    ]);
    try {
      [settings, versions] = await Promise.all([
        getCatalogSettings(supabase, ctx.organizationId),
        listCatalogVersions(supabase, ctx.organizationId, 20),
      ]);
    } catch {
      // Migration 034 may not be applied yet — degrade gracefully
      settings = FALLBACK_SETTINGS(ctx.organizationId);
      versions = [];
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Impossible de charger le catalogue';
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Catalogue</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Création IA, qualité, publication et aperçu menu QR — prêt pour la production
        </p>
      </div>

      {error ? (
        <ModuleError message={error} />
      ) : (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <CatalogClient
              categories={categories}
              items={items}
              canWrite={canWrite}
              settings={settings}
              versions={versions}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
