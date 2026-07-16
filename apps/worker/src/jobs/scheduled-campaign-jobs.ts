import {
  appendBroadcastCampaignSends,
  appendCampaignSendsFromPlans,
  countCampaignSends,
  finalizeScheduledCampaignExecution,
  getScheduledCampaignForExecution,
  INACTIVE_DAYS_THRESHOLD,
  isCampaignDue,
  listDueScheduledCampaigns,
  markScheduledCampaignExecutionFailed,
  notifyScheduledCampaignExecuted,
  usesAiGenerationForType,
} from '@loyala/domain-crm';
import { createAutomationService } from '@loyala/core-ai';
import type { CampaignPlanPayload } from '@loyala/domain-crm';
import { logStructured } from '@loyala/integrations';
import { campaignTypeToIntent } from '@loyala/messaging';
import { getWorkerAdminClient } from '../supabase.js';
import {
  fetchBirthdayClientsToday,
  fetchInactiveClientsForRelaunch,
  enrichWithInsights,
} from './campaign-jobs.js';
import {
  autoSendCampaignForTestClient,
  type AutoSendCampaignResult,
} from './whatsapp-auto-send.js';

export interface ScheduledCampaignExecutionResult {
  campaignId: string;
  organizationId: string;
  sendCount: number;
  skipped?: boolean;
  reason?: string;
  error?: string;
  autoSend?: AutoSendCampaignResult;
}

export async function executeScheduledCampaign(
  campaignId: string,
  organizationId: string
): Promise<ScheduledCampaignExecutionResult> {
  const admin = getWorkerAdminClient();
  const campaign = await getScheduledCampaignForExecution(admin, organizationId, campaignId);

  if (!campaign) {
    return {
      campaignId,
      organizationId,
      sendCount: 0,
      skipped: true,
      reason: 'campaign_not_found',
    };
  }

  if (!isCampaignDue(campaign)) {
    return {
      campaignId,
      organizationId,
      sendCount: 0,
      skipped: true,
      reason: 'not_due',
    };
  }

  const { data: org } = await admin
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .maybeSingle();
  const restaurantName = String(org?.name ?? 'Restaurant');

  const existingSends = await countCampaignSends(admin, organizationId, campaignId);
  if (existingSends > 0) {
    await finalizeScheduledCampaignExecution(admin, organizationId, campaign, existingSends, {
      executionNote: 'sends_already_materialized',
    });
    const autoSend = await autoSendCampaignForTestClient(admin, {
      organizationId,
      campaignId,
      intent: campaignTypeToIntent(campaign.type),
      restaurantName,
    });
    return {
      campaignId,
      organizationId,
      sendCount: existingSends,
      skipped: true,
      reason: 'already_executed',
      autoSend,
    };
  }

  try {
    let sendCount = 0;

    if (usesAiGenerationForType(campaign.type)) {
      sendCount = await executeScheduledCampaignWithAi(admin, campaign, restaurantName);
    } else {
      sendCount = await appendBroadcastCampaignSends(admin, {
        organizationId,
        campaignId: campaign.id,
        restaurantName,
        messageBody: campaign.message_preview ?? campaign.name,
      });
    }

    await finalizeScheduledCampaignExecution(admin, organizationId, campaign, sendCount, {
      executionSource: 'inngest_scheduled',
    });

    if (sendCount > 0) {
      await notifyScheduledCampaignExecuted(admin, organizationId, sendCount, campaign.name);
    }

    const autoSend =
      sendCount > 0
        ? await autoSendCampaignForTestClient(admin, {
            organizationId,
            campaignId,
            intent: campaignTypeToIntent(campaign.type),
            restaurantName,
          })
        : { attempted: false, sent: false, skippedReason: 'no_campaign_sends' };

    logStructured({
      level: sendCount > 0 ? 'info' : 'warn',
      service: 'worker',
      message: 'Scheduled campaign executed',
      context: { organizationId, campaignId, sendCount, type: campaign.type, autoSend },
    });

    return { campaignId, organizationId, sendCount, autoSend };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await markScheduledCampaignExecutionFailed(admin, organizationId, campaign, errorMessage);

    logStructured({
      level: 'error',
      service: 'worker',
      message: 'Scheduled campaign execution failed',
      context: { organizationId, campaignId, error: errorMessage },
    });

    return {
      campaignId,
      organizationId,
      sendCount: 0,
      error: errorMessage,
    };
  }
}

async function executeScheduledCampaignWithAi(
  admin: ReturnType<typeof getWorkerAdminClient>,
  campaign: Awaited<ReturnType<typeof getScheduledCampaignForExecution>>,
  restaurantName: string
): Promise<number> {
  if (!campaign) return 0;

  const automation = createAutomationService(campaign.organization_id);
  let plans: CampaignPlanPayload[] = [];
  let clientsForSends: Array<{
    id: string;
    full_name: string;
    phone: string;
    opt_in_whatsapp?: boolean;
  }> = [];

  if (campaign.type === 'birthday') {
    const rawClients = await fetchBirthdayClientsToday(campaign.organization_id);
    const eligible = rawClients.filter((c) => c.optInWhatsapp && c.phone);
    const birthdayClients = await enrichWithInsights(
      campaign.organization_id,
      eligible.map((c) => ({
        clientId: c.clientId,
        fullName: c.fullName,
        birthday: c.birthday,
      }))
    );
    plans = (await automation.runBirthdayCampaigns(
      birthdayClients,
      restaurantName
    )) as CampaignPlanPayload[];
    clientsForSends = eligible.map((c) => ({
      id: c.clientId,
      full_name: c.fullName,
      phone: c.phone,
      opt_in_whatsapp: c.optInWhatsapp,
    }));
  } else {
    const rawClients = await fetchInactiveClientsForRelaunch(campaign.organization_id);
    const inactive = automation.detectInactive(
      rawClients.map((c) => ({
        clientId: c.clientId,
        fullName: c.fullName,
        phone: c.phone,
        lastVisitAt: c.lastVisitAt,
        visitCount: c.visitCount,
        totalSpent: c.totalSpent,
      })),
      INACTIVE_DAYS_THRESHOLD
    );

    const loyaltyClients = inactive
      .filter((c) => {
        const raw = rawClients.find((r) => r.clientId === c.clientId);
        return raw?.optInWhatsapp && raw.phone;
      })
      .map((c) => ({
        clientId: c.clientId,
        fullName: c.fullName,
        loyaltyPoints: rawClients.find((r) => r.clientId === c.clientId)?.loyaltyPoints ?? 0,
        lastVisit: c.lastVisitAt ?? new Date(0).toISOString(),
      }));

    const enrichedLoyalty = await enrichWithInsights(campaign.organization_id, loyaltyClients);
    plans = (await automation.runLoyaltyRelances(enrichedLoyalty)) as CampaignPlanPayload[];
    clientsForSends = loyaltyClients.map((c) => {
      const raw = rawClients.find((r) => r.clientId === c.clientId)!;
      return {
        id: c.clientId,
        full_name: c.fullName,
        phone: raw.phone,
        opt_in_whatsapp: raw.optInWhatsapp,
      };
    });
  }

  if (plans.length === 0 || clientsForSends.length === 0) {
    return 0;
  }

  return appendCampaignSendsFromPlans(admin, {
    organizationId: campaign.organization_id,
    campaignId: campaign.id,
    restaurantName,
    plans,
    clients: clientsForSends,
  });
}

export async function runAllDueScheduledCampaigns(): Promise<{
  due: number;
  results: ScheduledCampaignExecutionResult[];
}> {
  const admin = getWorkerAdminClient();
  const dueCampaigns = await listDueScheduledCampaigns(admin);
  const results: ScheduledCampaignExecutionResult[] = [];

  for (const campaign of dueCampaigns) {
    results.push(await executeScheduledCampaign(campaign.id, campaign.organization_id));
  }

  return { due: dueCampaigns.length, results };
}
