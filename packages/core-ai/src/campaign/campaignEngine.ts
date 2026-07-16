export {
  CampaignEngine,
  type BirthdayClient,
  type LoyaltyClient,
  type CampaignPlan,
} from '../engines/campaign-engine';

import { CampaignEngine } from '../engines/campaign-engine';
import { detectInactiveClients, type InactiveClient } from '../engines/inactive-detection';
import { processBatch } from '../batch/processBatch';

/**
 * Campaign Engine facade — anniversaires, fidélité, promotions, inactifs.
 */
export class CampaignOrchestrator {
  private readonly engine: CampaignEngine;

  constructor(private readonly tenantId: string) {
    this.engine = new CampaignEngine(tenantId);
  }

  planBirthdaysToday(clients: Parameters<CampaignEngine['planBirthdayCampaigns']>[0]) {
    return this.engine.planBirthdayCampaigns(clients);
  }

  async runBirthdayBatch(
    clients: Parameters<CampaignEngine['planBirthdayCampaigns']>[0],
    restaurantName: string,
    offer?: string,
    concurrency = 3
  ) {
    const today = this.engine.planBirthdayCampaigns(clients);
    return processBatch(
      today,
      (c) => this.engine.generateBirthdayMessage(c, restaurantName, offer),
      { concurrency }
    );
  }

  detectInactive(clients: InactiveClient[], inactiveDays = 14) {
    return detectInactiveClients(clients, { inactiveDaysThreshold: inactiveDays });
  }

  planLoyaltyRelances(inactive: InactiveClient[], inactiveDays = 14) {
    return this.engine.planLoyaltyRelances(inactive, inactiveDays);
  }

  async runLoyaltyBatch(
    clients: Parameters<CampaignEngine['generateLoyaltyRelance']>[0][],
    concurrency = 3
  ) {
    return processBatch(clients, (c) => this.engine.generateLoyaltyRelance(c), {
      concurrency,
    });
  }

  suggestPromotions(context: Record<string, unknown>) {
    return this.engine.suggestPromotions(context);
  }
}

export function createCampaignOrchestrator(tenantId: string): CampaignOrchestrator {
  return new CampaignOrchestrator(tenantId);
}
