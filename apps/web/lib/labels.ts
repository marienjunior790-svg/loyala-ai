/** French display labels for codes stored in the database. Unknown codes are shown as-is. */

const SEGMENTS: Record<string, string> = {
  new: 'Nouveaux',
  regular: 'Réguliers',
  vip: 'VIP',
  inactive: 'Inactifs',
  at_risk: 'À risque',
};

const ROLES: Record<string, string> = {
  org_owner: 'Propriétaire',
  org_admin: 'Administrateur',
  org_manager: 'Manager',
  org_staff: 'Équipe',
  org_viewer: 'Lecture seule',
};

const PLANS: Record<string, string> = {
  trial: 'Gratuit',
  free: 'Gratuit',
  growth: 'Pro',
  pro: 'Pro+',
};

const PLAN_STATUSES: Record<string, string> = {
  trialing: 'Actif',
  active: 'Actif',
  past_due: 'Paiement en retard',
  canceled: 'Résilié',
  cancelled: 'Résilié',
  expired: 'Expiré',
};

const CAMPAIGN_TYPES: Record<string, string> = {
  manual: 'Manuelle',
  inactive: 'Inactifs',
  birthday: 'Anniversaire',
  loyalty: 'Fidélité',
  promotion: 'Promotion',
};

const CAMPAIGN_STATUSES: Record<string, string> = {
  draft: 'Brouillon',
  scheduled: 'Programmée',
  ready: 'Prête',
  running: 'En cours',
  paused: 'En pause',
  completed: 'Terminée',
  failed: 'Échec',
};

function label(map: Record<string, string>, code: string | null | undefined): string {
  if (!code) return '—';
  return map[code] ?? code;
}

export const segmentLabel = (code: string | null | undefined) => label(SEGMENTS, code);
export const roleLabel = (code: string | null | undefined) => label(ROLES, code);
export const planLabel = (code: string | null | undefined) => label(PLANS, code);
export const planStatusLabel = (code: string | null | undefined) => label(PLAN_STATUSES, code);
export const campaignTypeLabel = (code: string | null | undefined) => label(CAMPAIGN_TYPES, code);
export const campaignStatusLabel = (code: string | null | undefined) => label(CAMPAIGN_STATUSES, code);
