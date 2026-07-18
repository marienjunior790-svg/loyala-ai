'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthPermission } from '@/lib/auth/guard';
import { createClient } from '@/lib/supabase/server';
import {
  buildMenuContext,
  formatMenuContextForPrompt,
  bulkCreateCatalog,
  type MenuConsultantRequest,
  type MenuContextSnapshot,
} from '@loyala/domain-crm';
import { proxyToWorker } from '@/lib/worker/client';

const WRITE = 'clients:write' as const;

export type MenuConsultState = {
  error?: string;
  context?: MenuContextSnapshot;
  result?: {
    currency: string;
    summary: string;
    contextInsights: string[];
    proposals: {
      name: string;
      description: string;
      kind: string;
      courses: { role: string; catalogItemName: string; label?: string; price: number }[];
      suggestedPrice: number;
      discountPercent?: number;
      estimatedCost?: number;
      estimatedMargin?: number;
      estimatedMarginPct?: number;
      commercialAnalysis: string;
      confidence: number;
      confidenceReasons: string[];
    }[];
    marketing?: {
      whatsapp: string;
      sms: string;
      emailSubject: string;
      emailBody: string;
      facebook: string;
      instagram: string;
      tiktok: string;
      linkedin?: string;
      hashtags: string[];
      posterPrompt: string;
    };
    catalogAdditions?: {
      category: string;
      name: string;
      description?: string;
      price: number;
      type?: 'product' | 'service' | 'rental';
    }[];
  };
};

/** Build data context only (advanced UX preview before calling the model). */
export async function previewMenuContextAction(
  input: MenuConsultantRequest = {}
): Promise<MenuConsultState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const supabase = await createClient();
    const context = await buildMenuContext(supabase, ctx.organizationId, {
      ...input,
      mode: input.mode ?? 'advanced',
    });
    return { context };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur contexte menu' };
  }
}

/** Full consultant: aggregate context → AI proposals + marketing pack. */
export async function consultMenuAction(
  input: MenuConsultantRequest = {}
): Promise<MenuConsultState> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const supabase = await createClient();
    const context = await buildMenuContext(supabase, ctx.organizationId, {
      ...input,
      mode: input.mode ?? 'advanced',
    });
    const contextText = formatMenuContextForPrompt(context);

    const result = await proxyToWorker<NonNullable<MenuConsultState['result']>>('menu/consult', {
      method: 'POST',
      organizationId: ctx.organizationId,
      body: {
        contextText,
        currency: context.organization.currency,
      },
    });

    if (!result.ok) {
      return { error: result.error ?? 'Consultant menu indisponible', context };
    }

    const data = result.data;
    if (!data?.proposals?.length) {
      return {
        error: "L'IA n'a pas renvoyé de proposition de menu. Réessayez.",
        context,
      };
    }

    return { context, result: data };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur consultant menu' };
  }
}

/** Persist selected menu as a catalog combo product (+ optional additions). */
export async function applyMenuProposalAction(input: {
  proposalName: string;
  proposalDescription?: string;
  suggestedPrice: number;
  courses: { role: string; catalogItemName: string; price: number }[];
  currency?: string;
  additions?: {
    category: string;
    name: string;
    description?: string;
    price: number;
    type?: 'product' | 'service' | 'rental';
  }[];
}): Promise<{ error?: string; success?: string }> {
  try {
    const ctx = await requireAuthPermission(WRITE);
    const supabase = await createClient();
    const currency = input.currency?.trim() || 'XOF';

    const composition = input.courses
      .map((c) => `${c.role}: ${c.catalogItemName} (${c.price})`)
      .join(' · ');

    const categoryMap = new Map<
      string,
      { name: string; description: string; price: number; type: 'product' | 'service' | 'rental' }[]
    >();

    const menus = categoryMap.get('Menus') ?? [];
    menus.push({
      name: input.proposalName,
      description: `${input.proposalDescription ?? ''}\n\nComposition: ${composition}`.trim(),
      price: input.suggestedPrice,
      type: 'product',
    });
    categoryMap.set('Menus', menus);

    for (const a of input.additions ?? []) {
      const cat = a.category?.trim() || 'Menus';
      const list = categoryMap.get(cat) ?? [];
      list.push({
        name: a.name,
        description: a.description ?? '',
        price: a.price,
        type: a.type ?? 'product',
      });
      categoryMap.set(cat, list);
    }

    const categories = [...categoryMap.entries()].map(([name, items]) => ({
      name,
      description: name === 'Menus' ? 'Menus combinés générés par le consultant IA' : '',
      items,
    }));

    const { itemsCreated } = await bulkCreateCatalog(supabase, ctx.organizationId, {
      currency,
      categories,
    });
    revalidatePath('/catalogue');
    return { success: `Menu « ${input.proposalName} » publié (${itemsCreated} article(s))` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur publication du menu' };
  }
}
