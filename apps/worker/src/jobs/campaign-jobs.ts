import { createAutomationService } from '@loyala/core-ai';
import { getWorkerAdminClient } from '../supabase.js';
import type { BirthdayClient } from '@loyala/core-ai';

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
): Promise<BirthdayClient[]> {
  const admin = getWorkerAdminClient();
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const { data, error } = await admin
    .from('clients')
    .select('id, full_name, date_of_birth')
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
    .select('id, full_name, phone, last_visit_at, visit_count, total_spent, loyalty_points')
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
  }));
}

export async function runBirthdayCampaignForOrg(organizationId: string, restaurantName: string) {
  const clients = await fetchBirthdayClientsToday(organizationId);
  if (clients.length === 0) {
    return { organizationId, campaigns: [], skipped: true, reason: 'no_birthdays_today' };
  }

  const automation = createAutomationService(organizationId);
  const campaigns = await automation.runBirthdayCampaigns(clients, restaurantName);

  return { organizationId, campaigns, count: campaigns.length };
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

  const loyaltyClients = inactive.map((c) => ({
    clientId: c.clientId,
    fullName: c.fullName,
    loyaltyPoints: rawClients.find((r) => r.clientId === c.clientId)?.loyaltyPoints ?? 0,
    lastVisit: c.lastVisitAt ?? new Date(0).toISOString(),
  }));

  const campaigns = await automation.runLoyaltyRelances(loyaltyClients);

  return { organizationId, campaigns, count: campaigns.length, inactiveDetected: inactive.length };
}
