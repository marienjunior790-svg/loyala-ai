/**
 * Loyala AI Automation — 7 business functions for worker / jobs.
 */
import { createRFMEngine } from '../rfm/rfmEngine';
import { createClassificationPipeline } from '../pipeline/classificationPipeline';
import { createCampaignOrchestrator } from '../campaign/campaignEngine';
import { generateAutoReply } from '../engines/auto-reply';
import { analyzeInactiveClient, type InactiveClient } from '../engines/inactive-detection';
import { orchestrate } from '../orchestrator/orchestrate';
import { generateImages, buildProductImagePrompt } from './image-generation';
import {
  catalogGenerateSchema,
  variantSuggestSchema,
  type CatalogGenerate,
  type VariantSuggest,
} from '../schemas/outputs';
import type { ClientRFMInput } from '../rfm/scoring';
import type { BirthdayClient, LoyaltyClient } from '../engines/campaign-engine';

export interface CatalogGenerateRequest {
  brief: string;
  establishmentType?: string;
  currency?: string;
  existingCategories?: string[];
}

export interface CatalogImportRequest {
  rawText?: string;
  /** Base64 data URLs for photo/scan (vision OCR) imports. */
  images?: string[];
  establishmentType?: string;
  currency?: string;
  existingCategories?: string[];
}

export interface VariantSuggestRequest {
  items: { name: string; category?: string; type?: string }[];
  establishmentType?: string;
  currency?: string;
}

/** Max products enriched per model call (token budget guard). */
const VARIANT_SUGGEST_MAX_ITEMS = 40;

/** Max characters of imported content sent to the model (token budget guard). */
const CATALOG_IMPORT_MAX_CHARS = 14_000;

export class AutomationService {
  private readonly rfm: ReturnType<typeof createRFMEngine>;
  private readonly classification: ReturnType<typeof createClassificationPipeline>;
  private readonly campaigns: ReturnType<typeof createCampaignOrchestrator>;

  constructor(private readonly tenantId: string) {
    this.rfm = createRFMEngine(tenantId);
    this.classification = createClassificationPipeline(tenantId);
    this.campaigns = createCampaignOrchestrator(tenantId);
  }

  /** 1. Segmentation RFM + IA ciblée */
  segmentClients(clients: (ClientRFMInput & { fullName: string })[]) {
    return this.rfm.enrichWithAI(clients);
  }

  scoreRFM(clients: ClientRFMInput[]) {
    return this.rfm.scoreBatch(clients);
  }

  /** 2. Détection inactifs */
  detectInactive(clients: InactiveClient[], inactiveDays = 14) {
    return this.campaigns.detectInactive(clients, inactiveDays);
  }

  analyzeInactive(client: InactiveClient & { daysInactive: number }) {
    return analyzeInactiveClient(this.tenantId, client);
  }

  /** 3. Campagnes anniversaires */
  runBirthdayCampaigns(
    clients: BirthdayClient[],
    restaurantName: string,
    offer?: string
  ) {
    return this.campaigns.runBirthdayBatch(clients, restaurantName, offer);
  }

  /** 4. Relance fidélité */
  runLoyaltyRelances(clients: LoyaltyClient[]) {
    return this.campaigns.runLoyaltyBatch(clients);
  }

  /** 4b. Relance par affinité produit/catégorie */
  runAffinityRelances(clients: LoyaltyClient[]) {
    return this.campaigns.runAffinityBatch(clients);
  }

  planLoyaltyFromInactive(inactive: InactiveClient[], inactiveDays = 14) {
    return this.campaigns.planLoyaltyRelances(inactive, inactiveDays);
  }

  /** 5. Suggestions promotions */
  suggestPromotions(context: Record<string, unknown>) {
    return this.campaigns.suggestPromotions(context);
  }

  /** 8. Génération de catalogue par IA (création complète ou assistant conversationnel) */
  async generateCatalog(request: CatalogGenerateRequest): Promise<CatalogGenerate> {
    const currency = request.currency?.trim() || 'XOF';
    const response = await orchestrate({
      organizationId: this.tenantId,
      useCase: 'catalog.generate',
      input: {
        brief: request.brief,
        establishmentType: request.establishmentType?.trim() || 'Restaurant',
        currency,
        existingCategories:
          request.existingCategories && request.existingCategories.length > 0
            ? request.existingCategories.join(', ')
            : 'aucune',
      },
      jsonSchema: catalogGenerateSchema,
      skipCache: true,
    });
    return catalogGenerateSchema.parse(response.parsed ?? { currency, categories: [] });
  }

  /** 8b. Import intelligent: structure un menu brut (PDF/image/tableur/URL) sans inventer. */
  async importCatalog(request: CatalogImportRequest): Promise<CatalogGenerate> {
    const currency = request.currency?.trim() || 'XOF';
    const rawText = (request.rawText ?? '').slice(0, CATALOG_IMPORT_MAX_CHARS);
    const images = request.images?.filter(Boolean) ?? [];
    if (!rawText.trim() && images.length === 0) {
      return { currency, categories: [] };
    }
    const response = await orchestrate({
      organizationId: this.tenantId,
      useCase: 'catalog.import',
      input: {
        rawText: rawText.trim() || '(voir la ou les images jointes — lis le menu par OCR)',
        establishmentType: request.establishmentType?.trim() || 'Restaurant',
        currency,
        existingCategories:
          request.existingCategories && request.existingCategories.length > 0
            ? request.existingCategories.join(', ')
            : 'aucune',
      },
      images: images.length > 0 ? images : undefined,
      jsonSchema: catalogGenerateSchema,
      skipCache: true,
      skipGuard: true,
    });
    return catalogGenerateSchema.parse(response.parsed ?? { currency, categories: [] });
  }

  /**
   * 8d. Suggestion de variantes/suppléments par IA pour un lot de produits.
   * Réutilise le pipeline orchestrate existant. Réutilisable plus tard par le POS,
   * les commandes en ligne, les promotions et les menus combinés.
   */
  async suggestVariants(request: VariantSuggestRequest): Promise<VariantSuggest> {
    const currency = request.currency?.trim() || 'XOF';
    const items = request.items.filter((i) => i.name?.trim()).slice(0, VARIANT_SUGGEST_MAX_ITEMS);
    if (items.length === 0) return { items: [] };

    const products = items
      .map((i) => {
        const bits = [i.name.trim()];
        if (i.category) bits.push(`catégorie: ${i.category}`);
        if (i.type) bits.push(`type: ${i.type}`);
        return `- ${bits.join(' — ')}`;
      })
      .join('\n');

    const response = await orchestrate({
      organizationId: this.tenantId,
      useCase: 'catalog.variants',
      input: {
        establishmentType: request.establishmentType?.trim() || 'Restaurant',
        currency,
        products,
      },
      jsonSchema: variantSuggestSchema,
      skipCache: true,
      skipGuard: true,
    });
    return variantSuggestSchema.parse(response.parsed ?? { items: [] });
  }

  /** 8c. Génération d'images produit (IA) — contexte-aware, plusieurs variantes. */
  async generateProductImages(input: {
    name: string;
    category?: string;
    type?: string;
    establishment?: string;
    count?: number;
  }): Promise<{ images: string[] }> {
    const prompt = buildProductImagePrompt({
      name: input.name,
      category: input.category,
      type: input.type,
      establishment: input.establishment,
    });
    const images = await generateImages({ prompt, count: input.count });
    return { images };
  }

  /** 6. Réponses automatiques */
  generateReply(input: Parameters<typeof generateAutoReply>[1]) {
    return generateAutoReply(this.tenantId, input);
  }

  /** 7. Classification + priority score */
  classifyMessage(input: Parameters<typeof this.classification.classify>[0]) {
    return this.classification.classify(input);
  }

  classifyMessages(
    messages: Parameters<typeof this.classification.classifyBatch>[0],
    concurrency?: number
  ) {
    return this.classification.classifyBatch(messages, concurrency);
  }
}

export function createAutomationService(tenantId: string): AutomationService {
  return new AutomationService(tenantId);
}
