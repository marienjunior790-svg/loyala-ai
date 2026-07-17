/**
 * Loyala AI Automation — 7 business functions for worker / jobs.
 */
import { createRFMEngine } from '../rfm/rfmEngine';
import { createClassificationPipeline } from '../pipeline/classificationPipeline';
import { createCampaignOrchestrator } from '../campaign/campaignEngine';
import { generateAutoReply } from '../engines/auto-reply';
import { analyzeInactiveClient, type InactiveClient } from '../engines/inactive-detection';
import type { ClientRFMInput } from '../rfm/scoring';
import type { BirthdayClient, LoyaltyClient } from '../engines/campaign-engine';

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
