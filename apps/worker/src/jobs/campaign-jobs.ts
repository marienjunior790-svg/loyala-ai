import {
  persistCampaignPlans,
  listOrgNotifyUserIds,
  type CampaignPlanPayload,
} from '@loyala/domain-crm';
import { notifyCampaignReadyByEmail } from '@loyala/integrations';
import { logStructured } from '@loyala/integrations';
import { createAutomationService } from '@loyala/core-ai';
import { getWorkerAdminClient } from '../supabase.js';
import type { BirthdayClient } from '@loyala/core-ai';

export interface BirthdayClientRow extends BirthdayClient {
  phone: string;
  optInWhatsapp: boolean;
}

export interface OrgRow {
  id: string;
  name: string;
}

export async function listActiveOrganizations(): Promise<OrgRow[]> {
  const admin = getWorkerAdminClient();
  const { data, error } = await admin
    .from('organizations')
    .select('id, name')
    .is('deleted_at', null)
    .in('plan_status', ['trialing', 'active']);

  if (error) throw new Error(`listActiveOrganizations: ${error.message}`);
  return (data ?? []) as OrgRow[];
}

export async function fetchBirthdayClientsToday(
  organizationId: string
): Promise<BirthdayClientRow[]> {
  const admin = getWorkerAdminClient();
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const { data, error } = await admin
    .from('clients')
    .select('id, full_name, phone, date_of_birth, opt_in_whatsapp')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .not('date_of_birth', 'is', null);

  if (error) throw new Error(`fetchBirthdayClients: ${error.message}`);

  return (data ?? [])
    .filter((row) => {
      const dob = new Date(String(row.date_of_birth));
      return dob.getMonth() + 1 === month && dob.getDate() === day;
    })
    .map((row) => ({
      clientId: String(row.id),
      fullName: String(row.full_name),
      birthday: String(row.date_of_birth),
      phone: String(row.phone ?? ''),
      optInWhatsapp: row.opt_in_whatsapp !== false,
    }));
}

export async function fetchInactiveClientsForRelaunch(
  organizationId: string,
  inactiveDays = 30
) {
  const admin = getWorkerAdminClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - inactiveDays);

  const { data, error } = await admin
    .from('clients')
    .select('id, full_name, phone, last_visit_at, visit_count, total_spent, loyalty_points, opt_in_whatsapp')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .or(`last_visit_at.is.null,last_visit_at.lt.${cutoff.toISOString()}`);

  if (error) throw new Error(`fetchInactiveClients: ${error.message}`);

  return (data ?? []).map((row) => ({
    clientId: String(row.id),
    fullName: String(row.full_name),
    phone: String(row.phone),
    lastVisitAt: row.last_visit_at ? String(row.last_visit_at) : null,
    visitCount: Number(row.visit_count ?? 0),
    totalSpent: Number(row.total_spent ?? 0),
    loyaltyPoints: Number(row.loyalty_points ?? 0),
    lastVisit: row.last_visit_at ? String(row.last_visit_at) : new Date(0).toISOString(),
    optInWhatsapp: row.opt_in_whatsapp !== false,
  }));
}

async function notifyAdminsByEmail(
  organizationId: string,
  restaurantName: string,
  count: number,
  campaignType: string
) {
  const admin = getWorkerAdminClient();
  const notifyIds = await listOrgNotifyUserIds(admin, organizationId);
  if (notifyIds.length === 0) return;

  const { data: users } = await admin.auth.admin.listUsers({ perPage: 100 });
  const emailMap = new Map(
    (users?.users ?? []).map((u) => [u.id, u.email]).filter(([, e]) => Boolean(e)) as [string, string][]
  );

  for (const userId of notifyIds) {
    const email = emailMap.get(userId);
    if (!email) continue;
    try {
      await notifyCampaignReadyByEmail({
        to: email,
        restaurantName,
        count,
        campaignType,
      });
    } catch (error) {
      logStructured({
        level: 'warn',
        service: 'worker',
        message: 'Campaign email notification failed',
        context: { organizationId, error: error instanceof Error ? error.message : String(error) },
      });
    }
  }
}

export async function runBirthdayCampaignForOrg(organizationId: string, restaurantName: string) {
  const rawClients = await fetchBirthdayClientsToday(organizationId);
  const clients: BirthdayClient[] = rawClients.map(({ clientId, fullName, birthday }) => ({
    clientId,
    fullName,
    birthday,
  }));

  if (clients.length === 0) {
    return { organizationId, campaigns: [], skipped: true, reason: 'no_birthdays_today' };
  }

  const automation = createAutomationService(organizationId);
  const campaigns = await automation.runBirthdayCampaigns(clients, restaurantName);

  const admin = getWorkerAdminClient();
  const { campaignId, sendCount } = await persistCampaignPlans(admin, {
    organizationId,
    restaurantName,
    campaignType: 'birthday',
    campaignName: `Anniversaires — ${new Date().toLocaleDateString('fr-FR')}`,
    plans: campaigns as CampaignPlanPayload[],
    clients: rawClients
      .filter((c) => c.optInWhatsapp && c.phone)
      .map((c) => ({
        id: c.clientId,
        full_name: c.fullName,
        phone: c.phone,
        opt_in_whatsapp: c.optInWhatsapp,
      })),
    source: 'cron',
  });

  if (sendCount > 0) {
    await notifyAdminsByEmail(organizationId, restaurantName, sendCount, 'anniversaire');
  }

  logStructured({
    level: 'info',
    service: 'worker',
    message: 'Birthday campaign persisted',
    context: { organizationId, campaignId, sendCount },
  });

  return { organizationId, campaigns, count: campaigns.length, campaignId, sendCount };
}

export async function runInactiveRelaunchForOrg(organizationId: string, inactiveDays = 30) {
  const rawClients = await fetchInactiveClientsForRelaunch(organizationId, inactiveDays);
  const automation = createAutomationService(organizationId);

  const inactive = automation.detectInactive(
    rawClients.map((c) => ({
      clientId: c.clientId,
      fullName: c.fullName,
      phone: c.phone,
      lastVisitAt: c.lastVisitAt,
      visitCount: c.visitCount,
      totalSpent: c.totalSpent,
    })),
    inactiveDays
  );

  if (inactive.length === 0) {
    return { organizationId, campaigns: [], skipped: true, reason: 'no_inactive_clients' };
  }

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

  if (loyaltyClients.length === 0) {
    return { organizationId, campaigns: [], skipped: true, reason: 'no_opted_in_clients' };
  }

  const campaigns = await automation.runLoyaltyRelances(loyaltyClients);

  const admin = getWorkerAdminClient();
  const org = await admin
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .maybeSingle();
  const restaurantName = String(org.data?.name ?? 'Restaurant');

  const { campaignId, sendCount } = await persistCampaignPlans(admin, {
    organizationId,
    restaurantName,
    campaignType: 'inactive',
    campaignName: `Relance inactifs auto — ${new Date().toLocaleDateString('fr-FR')}`,
    plans: campaigns as CampaignPlanPayload[],
    clients: loyaltyClients.map((c) => {
      const raw = rawClients.find((r) => r.clientId === c.clientId)!;
      return {
        id: c.clientId,
        full_name: c.fullName,
        phone: raw.phone,
        opt_in_whatsapp: raw.optInWhatsapp,
      };
    }),
    source: 'cron',
  });

  if (sendCount > 0) {
    await notifyAdminsByEmail(organizationId, restaurantName, sendCount, 'inactifs');
  }

  logStructured({
    level: 'info',
    service: 'worker',
    message: 'Inactive campaign persisted',
    context: { organizationId, campaignId, sendCount },
  });

  return {
    organizationId,
    campaigns,
    count: campaigns.length,
    campaignId,
    sendCount,
    inactiveDetected: inactive.length,
  };
}
