import { orchestrate } from '../orchestrator/orchestrate';
import {
  birthdayCampaignSchema,
  loyaltyCampaignSchema,
  promotionSuggestSchema,
} from '../schemas/outputs';
import type {
  BirthdayCampaign,
  LoyaltyCampaign,
  PromotionSuggest,
} from '../schemas/outputs';
import { detectInactiveClients, type InactiveClient } from './inactive-detection';
import { formatClientInsights, type ClientInsightSummary } from '../types/insights';

export interface BirthdayClient {
  clientId: string;
  fullName: string;
  birthday: string;
  insights?: ClientInsightSummary;
}

export interface LoyaltyClient {
  clientId: string;
  fullName: string;
  loyaltyPoints: number;
  lastVisit: string;
  insights?: ClientInsightSummary;
}

export interface CampaignPlan<T> {
  clientId: string;
  type: 'birthday' | 'loyalty' | 'promotion';
  content: T;
  scheduledAt?: string;
}

export class CampaignEngine {
  constructor(private readonly organizationId: string) {}

  async generateBirthdayMessage(
    client: BirthdayClient,
    restaurantName: string,
    offer = '15% de réduction'
  ): Promise<CampaignPlan<BirthdayCampaign>> {
    const response = await orchestrate({
      organizationId: this.organizationId,
      useCase: 'campaign.birthday.generate',
      input: {
        clientName: client.fullName,
        restaurantName,
        offer,
        insights: formatClientInsights(client.insights) || "Pas d'historique d'achat",
      },
      jsonSchema: birthdayCampaignSchema,
    });

    return {
      clientId: client.clientId,
      type: 'birthday',
      content: response.parsed as BirthdayCampaign,
      scheduledAt: client.birthday,
    };
  }

  async generateLoyaltyRelance(client: LoyaltyClient): Promise<CampaignPlan<LoyaltyCampaign>> {
    const response = await orchestrate({
      organizationId: this.organizationId,
      useCase: 'campaign.loyalty.generate',
      input: {
        clientName: client.fullName,
        points: String(client.loyaltyPoints),
        lastVisit: client.lastVisit,
        insights: formatClientInsights(client.insights) || "Pas d'historique d'achat",
      },
      jsonSchema: loyaltyCampaignSchema,
    });

    return {
      clientId: client.clientId,
      type: 'loyalty',
      content: response.parsed as LoyaltyCampaign,
    };
  }

  async suggestPromotions(context: Record<string, unknown>): Promise<PromotionSuggest> {
    const response = await orchestrate({
      organizationId: this.organizationId,
      useCase: 'campaign.promotion.suggest',
      input: { payload: JSON.stringify(context) },
      jsonSchema: promotionSuggestSchema,
    });

    return response.parsed as PromotionSuggest;
  }

  planBirthdayCampaigns(
    clients: BirthdayClient[],
    today = new Date()
  ): BirthdayClient[] {
    const month = today.getMonth();
    const day = today.getDate();

    return clients.filter((c) => {
      const bday = new Date(c.birthday);
      return bday.getMonth() === month && bday.getDate() === day;
    });
  }

  planLoyaltyRelances(
    clients: InactiveClient[],
    inactiveDays = 14
  ): (InactiveClient & { daysInactive: number })[] {
    return detectInactiveClients(clients, { inactiveDaysThreshold: inactiveDays });
  }
}
