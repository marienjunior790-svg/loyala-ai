/**
 * P2.6 — Activité campagnes / envois (lecture seule).
 * Pas de ROI, ouverture, clic ou livraison WhatsApp API (absents du schéma).
 * Aucun envoi automatique.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Campaign, CampaignSend, CampaignStatus } from './campaigns';
import { localDay } from './client-dashboard';

/** Minimum d’envois « terminés » (sent+failed) pour publier un taux de marquage. */
export const MI_CAMPAIGN_SEND_RATE_MIN = 5;

export type MiCampaignSendStatus = 'pending' | 'sent' | 'failed' | 'other';

export interface MiCampaignActivityInsight {
  period: { from: string; to: string; label: string };
  sampleCampaignsLoaded: number;
  sampleSendsLoaded: number;
  /** Campagnes dont created_at tombe dans la période. */
  campaignsInPeriod: number;
  campaignsByStatus: Partial<Record<string, number>>;
  campaignsByType: Partial<Record<string, number>>;
  /** Envois dont created_at (ou sent_at si sent) tombe dans la période. */
  sendsInPeriod: number;
  pendingCount: number;
  sentCount: number;
  failedCount: number;
  otherStatusCount: number;
  /**
   * sent / (sent + failed) * 100 — null si volume insuffisant.
   * = taux de marquage « envoyé » côté CRM, pas un delivery receipt WhatsApp.
   */
  markedSentRatePct: number | null;
  /** pending / sendsInPeriod * 100 — null si aucun envoi période. */
  pendingSharePct: number | null;
  /** Somme target_count des campagnes période (indicatif audience planifiée). */
  plannedTargetSum: number;
  draftOrReadyCount: number;
  completedCount: number;
  failedCampaignCount: number;
  limitations: string[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function inRange(day: string, from: string, to: string): boolean {
  return day >= from && day <= to;
}

function normalizeSendStatus(raw: string | null | undefined): MiCampaignSendStatus {
  const s = (raw ?? '').toLowerCase().trim();
  if (s === 'pending') return 'pending';
  if (s === 'sent') return 'sent';
  if (s === 'failed') return 'failed';
  return 'other';
}

export interface ListCampaignsForMiOptions {
  limit?: number;
  createdSince?: string;
}

/** Liste campagnes pour MI (réutilise la table campaigns, RLS org). */
export async function listCampaignsForMi(
  supabase: SupabaseClient,
  organizationId: string,
  options: ListCampaignsForMiOptions = {}
): Promise<Campaign[]> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  let query = supabase
    .from('campaigns')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options.createdSince) {
    query = query.gte('created_at', options.createdSince);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Campaign[]).map((row) => ({
    ...row,
    scheduled_at:
      row.scheduled_at ??
      (typeof row.metadata?.scheduledAt === 'string' ? row.metadata.scheduledAt : null),
    metadata: row.metadata ?? {},
  }));
}

export interface ListCampaignSendsForMiOptions {
  limit?: number;
  createdSince?: string;
}

/** Liste envois pour MI (sans jointure clients — pas de PII vers le prompt). */
export async function listCampaignSendsForMi(
  supabase: SupabaseClient,
  organizationId: string,
  options: ListCampaignSendsForMiOptions = {}
): Promise<Array<Pick<CampaignSend, 'id' | 'campaign_id' | 'status' | 'sent_at' | 'created_at' | 'channel'>>> {
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 2000);
  let query = supabase
    .from('campaign_sends')
    .select('id, campaign_id, status, sent_at, created_at, channel')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options.createdSince) {
    query = query.gte('created_at', options.createdSince);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<
    Pick<CampaignSend, 'id' | 'campaign_id' | 'status' | 'sent_at' | 'created_at' | 'channel'>
  >;
}

/**
 * Agrège l’activité campagnes sur une période MI.
 */
export function computeMiCampaignActivityInsight(input: {
  campaigns: Array<
    Pick<Campaign, 'type' | 'status' | 'target_count' | 'created_at' | 'scheduled_at'>
  >;
  sends: Array<
    Pick<CampaignSend, 'status' | 'sent_at' | 'created_at'>
  >;
  period: { from: string; to: string; label: string };
  timezone: string;
}): MiCampaignActivityInsight {
  const limitations: string[] = [
    'Pas de ROI / CA attributé aux campagnes (non disponible en CRM).',
    'Pas de taux d’ouverture, de clic ni de delivery receipt WhatsApp API dans le schéma.',
    'status=sent = marquage CRM (souvent après ouverture du lien wa.me), pas une preuve de lecture.',
    'Aucun envoi WhatsApp automatique depuis MI / ce snapshot.',
  ];

  const campaignsByStatus: Record<string, number> = {};
  const campaignsByType: Record<string, number> = {};
  let campaignsInPeriod = 0;
  let plannedTargetSum = 0;
  let draftOrReadyCount = 0;
  let completedCount = 0;
  let failedCampaignCount = 0;

  for (const c of input.campaigns) {
    const day = localDay(c.created_at, input.timezone);
    if (!day || !inRange(day, input.period.from, input.period.to)) continue;
    campaignsInPeriod += 1;
    const st = (c.status ?? 'unknown').toString();
    const ty = (c.type ?? 'unknown').toString();
    campaignsByStatus[st] = (campaignsByStatus[st] ?? 0) + 1;
    campaignsByType[ty] = (campaignsByType[ty] ?? 0) + 1;
    plannedTargetSum += Number(c.target_count ?? 0) || 0;
    if (st === 'draft' || st === 'ready' || st === 'scheduled' || st === 'paused') {
      draftOrReadyCount += 1;
    }
    if (st === 'completed') completedCount += 1;
    if (st === 'failed') failedCampaignCount += 1;
  }

  let sendsInPeriod = 0;
  let pendingCount = 0;
  let sentCount = 0;
  let failedCount = 0;
  let otherStatusCount = 0;

  for (const s of input.sends) {
    const anchor = s.sent_at && normalizeSendStatus(s.status) === 'sent' ? s.sent_at : s.created_at;
    const day = localDay(anchor, input.timezone);
    if (!day || !inRange(day, input.period.from, input.period.to)) continue;
    sendsInPeriod += 1;
    const st = normalizeSendStatus(s.status);
    if (st === 'pending') pendingCount += 1;
    else if (st === 'sent') sentCount += 1;
    else if (st === 'failed') failedCount += 1;
    else otherStatusCount += 1;
  }

  const finished = sentCount + failedCount;
  let markedSentRatePct: number | null = null;
  if (finished >= MI_CAMPAIGN_SEND_RATE_MIN) {
    markedSentRatePct = round2((sentCount / finished) * 100);
  } else if (sendsInPeriod > 0) {
    limitations.push(
      `Taux de marquage « sent » non publié (sent+failed=${finished} < ${MI_CAMPAIGN_SEND_RATE_MIN}).`
    );
  }

  const pendingSharePct =
    sendsInPeriod > 0 ? round2((pendingCount / sendsInPeriod) * 100) : null;

  if (input.campaigns.length === 0 && input.sends.length === 0) {
    limitations.push('Aucune campagne ni envoi dans l’échantillon chargé pour cette organisation.');
  } else if (campaignsInPeriod === 0 && sendsInPeriod === 0) {
    limitations.push(
      `Aucune activité campagne/envoi datée sur ${input.period.from} → ${input.period.to}.`
    );
  }

  if (input.sends.length >= 500 || input.campaigns.length >= 100) {
    limitations.push(
      'Échantillon campagnes/envois plafonné — stats période peuvent sous-couvrir une org très active.'
    );
  }

  return {
    period: input.period,
    sampleCampaignsLoaded: input.campaigns.length,
    sampleSendsLoaded: input.sends.length,
    campaignsInPeriod,
    campaignsByStatus,
    campaignsByType,
    sendsInPeriod,
    pendingCount,
    sentCount,
    failedCount,
    otherStatusCount,
    markedSentRatePct,
    pendingSharePct,
    plannedTargetSum,
    draftOrReadyCount,
    completedCount,
    failedCampaignCount,
    limitations,
  };
}

/** Helper typé pour tests / garde-fous status campagne. */
export function isKnownCampaignStatus(value: string): value is CampaignStatus {
  return (
    value === 'draft' ||
    value === 'ready' ||
    value === 'scheduled' ||
    value === 'paused' ||
    value === 'completed' ||
    value === 'failed'
  );
}
