'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthPermission } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import {
  getCatalogSettings,
  listCatalogVersions,
  createCatalogVersion,
  publishCatalog,
  updateCatalogPublicationStatus,
  restoreCatalogVersion,
  type CatalogPublicationStatus,
} from '@loyala/domain-crm';

const WRITE = 'clients:write' as const;

function revalidateCatalog() {
  revalidatePath('/catalogue');
}

export type PublicationActionState = { error?: string; success?: string };

export async function getCatalogPublicationStateAction() {
  const ctx = await requireAuthPermission('clients:read');
  const supabase = await createClient();
  const [settings, versions] = await Promise.all([
    getCatalogSettings(supabase, ctx.organizationId),
    listCatalogVersions(supabase, ctx.organizationId, 20),
  ]);
  return { settings, versions };
}

export async function setPublicationStatusAction(
  status: CatalogPublicationStatus
): Promise<PublicationActionState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const supabase = await createClient();
    if (status === 'published') {
      await publishCatalog(supabase, ctx.organizationId, { createdBy: ctx.userId });
      revalidateCatalog();
      return { success: 'Catalogue publié (nouvelle version créée)' };
    }
    await updateCatalogPublicationStatus(supabase, ctx.organizationId, status);
    revalidateCatalog();
    const labels: Record<CatalogPublicationStatus, string> = {
      draft: 'Brouillon',
      in_review: 'En révision',
      published: 'Publié',
      archived: 'Archivé',
    };
    return { success: `Statut : ${labels[status]}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur publication' };
  }
}

export async function saveCatalogVersionAction(label?: string): Promise<PublicationActionState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const supabase = await createClient();
    const version = await createCatalogVersion(supabase, ctx.organizationId, {
      label: label || 'Snapshot manuel',
      status: 'draft',
      createdBy: ctx.userId,
    });
    revalidateCatalog();
    return { success: `Version v${version.version_number} enregistrée` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur sauvegarde version' };
  }
}

export async function restoreCatalogVersionAction(versionId: string): Promise<PublicationActionState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const supabase = await createClient();
    const restored = await restoreCatalogVersion(
      supabase,
      ctx.organizationId,
      versionId,
      ctx.userId
    );
    await updateCatalogPublicationStatus(supabase, ctx.organizationId, 'draft');
    revalidateCatalog();
    return {
      success: `Catalogue restauré → brouillon (audit v${restored.version_number})`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur restauration' };
  }
}
