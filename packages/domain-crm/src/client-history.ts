import type { SupabaseClient } from '@supabase/supabase-js';
import type { Client } from './clients';
import { listClientVisits, type ClientVisit } from './visits';

/**
 * Unified per-client CRM timeline ("Historique CRM").
 *
 * Aggregates every activity source that is linked to a client and tenant-scoped:
 *  - client lifecycle (creation)                       → `clients`
 *  - visits & purchases (achats)                       → `client_visits`
 *  - WhatsApp / SMS / email messages (communications)  → `whatsapp_messages`
 *  - relances / marketing sends                        → `campaign_sends`
 *  - loyalty points (fidélité)                         → `loyalty_transactions`
 *  - Google / manual reviews (avis)                    → `reviews`
 *  - AI actions & staff edits (audit)                  → `domain_events`
 *
 * Sources that do not exist yet (📞 phone calls, 📅 reservations) are simply
 * absent from the timeline until their tables are introduced.
 */

export type ClientTimelineCategory =
  | 'lifecycle'
  | 'communication'
  | 'purchase'
  | 'loyalty'
  | 'marketing'
  | 'review'
  | 'ai'
  | 'staff'
  | 'notes';

export interface ClientTimelineEvent {
  /** Stable per-source id (prefixed to avoid cross-source collisions). */
  id: string;
  category: ClientTimelineCategory;
  /** Emoji marker for quick visual scanning. */
  icon: string;
  title: string;
  summary: string | null;
  /** ISO timestamp used for sorting (newest first). */
  timestamp: string;
  /** Human label for who triggered the event ("Vous", "Équipe", "IA", …). */
  actor: string | null;
  /** Origin table, useful for debugging / detail rendering. */
  source: string;
  /** Full payload rendered in the clickable detail view. */
  details: Record<string, unknown>;
}

export const CLIENT_TIMELINE_CATEGORY_META: Record<
  ClientTimelineCategory,
  { label: string; icon: string }
> = {
  lifecycle: { label: 'Cycle de vie', icon: '🟢' },
  communication: { label: 'Communications', icon: '💬' },
  purchase: { label: 'Achats', icon: '🛍️' },
  loyalty: { label: 'Fidélité', icon: '🎁' },
  marketing: { label: 'Marketing', icon: '📣' },
  review: { label: 'Avis', icon: '⭐' },
  ai: { label: "Activités de l'IA", icon: '🤖' },
  staff: { label: 'Équipe', icon: '👤' },
  notes: { label: 'Notes internes', icon: '📝' },
};

// ─── Raw source rows ────────────────────────────────────────────────────────

export interface ClientMessageRow {
  id: string;
  client_id: string | null;
  phone: string;
  template_name: string | null;
  message_body: string | null;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ClientCampaignSendRow {
  id: string;
  client_id: string | null;
  channel: string;
  message_body: string;
  status: string;
  whatsapp_url: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface ClientLoyaltyRow {
  id: string;
  client_id: string;
  points_delta: number;
  reason: string;
  created_at: string;
}

export interface ClientReviewRow {
  id: string;
  client_id: string | null;
  source: string;
  rating: number;
  author_name: string;
  content: string;
  review_url: string | null;
  response_text: string | null;
  responded_at: string | null;
  reviewed_at: string;
}

export interface ClientDomainEventRow {
  id: string;
  event_type: string;
  actor_id: string | null;
  payload: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ─── Resilient per-client fetchers ──────────────────────────────────────────

function isMissingRelation(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find the table') ||
    m.includes('relation')
  );
}

async function safeSelect<T>(
  run: () => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<T[]> {
  try {
    const { data, error } = await run();
    if (error) {
      if (isMissingRelation(error.message)) return [];
      throw new Error(error.message);
    }
    return (data ?? []) as T[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMissingRelation(message)) return [];
    throw error;
  }
}

export function listClientWhatsAppMessages(
  supabase: SupabaseClient,
  organizationId: string,
  clientId: string,
  limit = 100
): Promise<ClientMessageRow[]> {
  return safeSelect<ClientMessageRow>(() =>
    supabase
      .from('whatsapp_messages')
      .select(
        'id, client_id, phone, template_name, message_body, status, sent_at, delivered_at, read_at, error_message, created_at'
      )
      .eq('organization_id', organizationId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(limit)
  );
}

export function listClientCampaignSends(
  supabase: SupabaseClient,
  organizationId: string,
  clientId: string,
  limit = 100
): Promise<ClientCampaignSendRow[]> {
  return safeSelect<ClientCampaignSendRow>(() =>
    supabase
      .from('campaign_sends')
      .select('id, client_id, channel, message_body, status, whatsapp_url, sent_at, created_at')
      .eq('organization_id', organizationId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(limit)
  );
}

export function listClientLoyaltyTransactions(
  supabase: SupabaseClient,
  organizationId: string,
  clientId: string,
  limit = 100
): Promise<ClientLoyaltyRow[]> {
  return safeSelect<ClientLoyaltyRow>(() =>
    supabase
      .from('loyalty_transactions')
      .select('id, client_id, points_delta, reason, created_at')
      .eq('organization_id', organizationId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(limit)
  );
}

export function listClientReviews(
  supabase: SupabaseClient,
  organizationId: string,
  clientId: string,
  limit = 50
): Promise<ClientReviewRow[]> {
  return safeSelect<ClientReviewRow>(() =>
    supabase
      .from('reviews')
      .select(
        'id, client_id, source, rating, author_name, content, review_url, response_text, responded_at, reviewed_at'
      )
      .eq('organization_id', organizationId)
      .eq('client_id', clientId)
      .order('reviewed_at', { ascending: false })
      .limit(limit)
  );
}

export function listClientDomainEvents(
  supabase: SupabaseClient,
  organizationId: string,
  clientId: string,
  limit = 100
): Promise<ClientDomainEventRow[]> {
  return safeSelect<ClientDomainEventRow>(() =>
    supabase
      .from('domain_events')
      .select('id, event_type, actor_id, payload, metadata, created_at')
      .eq('organization_id', organizationId)
      .eq('aggregate_type', 'client')
      .eq('aggregate_id', clientId)
      .order('created_at', { ascending: false })
      .limit(limit)
  );
}

// ─── Pure timeline builder ──────────────────────────────────────────────────

export interface BuildClientTimelineInput {
  client: Pick<Client, 'id' | 'full_name' | 'created_at' | 'notes'>;
  visits?: ClientVisit[];
  messages?: ClientMessageRow[];
  campaignSends?: ClientCampaignSendRow[];
  loyalty?: ClientLoyaltyRow[];
  reviews?: ClientReviewRow[];
  events?: ClientDomainEventRow[];
  /** Resolve "Vous" vs "Équipe" for staff-authored events. */
  currentUserId?: string | null;
}

function formatXof(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return `${Math.round(Number(amount)).toLocaleString('fr-FR')} XOF`;
}

function actorLabel(actorId: string | null, currentUserId?: string | null): string {
  if (!actorId) return 'Automatique';
  if (currentUserId && actorId === currentUserId) return 'Vous';
  return 'Équipe';
}

function isAiEvent(event: ClientDomainEventRow): boolean {
  const source =
    (event.metadata?.source as string | undefined) ??
    (event.payload?.source as string | undefined);
  if (typeof source === 'string' && /ai|auto|inngest|worker|system/i.test(source)) return true;
  return event.actor_id == null && /campaign|message\.received/.test(event.event_type);
}

interface DomainEventMeta {
  category: ClientTimelineCategory;
  icon: string;
  title: string;
}

function domainEventMeta(event: ClientDomainEventRow): DomainEventMeta | null {
  switch (event.event_type) {
    // Visits/expenses come from client_visits (richer) — avoid duplicates here.
    case 'client.visit.recorded':
    case 'client.expense.recorded':
      return null;
    case 'client.created':
      return { category: 'lifecycle', icon: '🟢', title: 'Client créé' };
    case 'client.updated':
      return { category: 'staff', icon: '👤', title: 'Fiche client modifiée' };
    case 'client.deleted':
      return { category: 'staff', icon: '👤', title: 'Client supprimé' };
    case 'campaign.created':
      return { category: 'marketing', icon: '📣', title: 'Campagne créée' };
    case 'campaign.scheduled':
      return { category: 'marketing', icon: '📣', title: 'Campagne planifiée' };
    case 'campaign.send.requested':
      return { category: 'marketing', icon: '📣', title: 'Envoi de campagne demandé' };
    case 'message.received':
      return { category: 'communication', icon: '💬', title: 'Message WhatsApp reçu' };
    default:
      return { category: 'staff', icon: '📌', title: event.event_type };
  }
}

function whatsAppStatusLabel(status: string): string {
  switch (status) {
    case 'queued':
      return 'En file';
    case 'sent':
      return 'Envoyé';
    case 'delivered':
      return 'Distribué';
    case 'read':
      return 'Lu';
    case 'failed':
      return 'Échec';
    default:
      return status;
  }
}

export function buildClientTimeline(input: BuildClientTimelineInput): ClientTimelineEvent[] {
  const { client, currentUserId } = input;
  const events: ClientTimelineEvent[] = [];

  // Client creation (always the oldest anchor).
  events.push({
    id: `client:${client.id}`,
    category: 'lifecycle',
    icon: '🟢',
    title: 'Client ajouté au CRM',
    summary: client.full_name,
    timestamp: client.created_at,
    actor: null,
    source: 'clients',
    details: { fullName: client.full_name, createdAt: client.created_at },
  });

  if (client.notes && client.notes.trim().length > 0) {
    events.push({
      id: `note:${client.id}`,
      category: 'notes',
      icon: '📝',
      title: 'Note interne',
      summary: client.notes,
      timestamp: client.created_at,
      actor: null,
      source: 'clients',
      details: { notes: client.notes },
    });
  }

  for (const visit of input.visits ?? []) {
    const isExpense = visit.kind === 'expense';
    events.push({
      id: `visit:${visit.id}`,
      category: 'purchase',
      icon: '🛍️',
      title: isExpense ? 'Dépense enregistrée' : 'Visite enregistrée',
      summary:
        visit.amount != null && Number(visit.amount) > 0
          ? formatXof(Number(visit.amount))
          : visit.notes || (isExpense ? 'Dépense' : 'Visite'),
      timestamp: visit.visited_at,
      actor: actorLabel(visit.created_by, currentUserId),
      source: 'client_visits',
      details: {
        kind: visit.kind,
        amount: visit.amount,
        notes: visit.notes,
        visitedAt: visit.visited_at,
      },
    });
  }

  for (const msg of input.messages ?? []) {
    events.push({
      id: `wa:${msg.id}`,
      category: 'communication',
      icon: '💬',
      title: `WhatsApp — ${whatsAppStatusLabel(msg.status)}`,
      summary: msg.message_body || msg.template_name || msg.phone,
      timestamp: msg.sent_at ?? msg.created_at,
      actor: 'Établissement',
      source: 'whatsapp_messages',
      details: {
        channel: 'whatsapp',
        direction: 'outbound',
        phone: msg.phone,
        template: msg.template_name,
        body: msg.message_body,
        status: msg.status,
        sentAt: msg.sent_at,
        deliveredAt: msg.delivered_at,
        readAt: msg.read_at,
        error: msg.error_message,
      },
    });
  }

  for (const send of input.campaignSends ?? []) {
    events.push({
      id: `send:${send.id}`,
      category: 'marketing',
      icon: '📣',
      title: `Relance ${send.channel}`,
      summary: send.message_body,
      timestamp: send.sent_at ?? send.created_at,
      actor: null,
      source: 'campaign_sends',
      details: {
        channel: send.channel,
        body: send.message_body,
        status: send.status,
        whatsappUrl: send.whatsapp_url,
        sentAt: send.sent_at,
      },
    });
  }

  for (const tx of input.loyalty ?? []) {
    const gained = Number(tx.points_delta) >= 0;
    events.push({
      id: `loyalty:${tx.id}`,
      category: 'loyalty',
      icon: '🎁',
      title: gained ? 'Points de fidélité gagnés' : 'Points de fidélité utilisés',
      summary: `${gained ? '+' : ''}${tx.points_delta} pts — ${tx.reason}`,
      timestamp: tx.created_at,
      actor: null,
      source: 'loyalty_transactions',
      details: { pointsDelta: tx.points_delta, reason: tx.reason },
    });
  }

  for (const review of input.reviews ?? []) {
    events.push({
      id: `review:${review.id}`,
      category: 'review',
      icon: '⭐',
      title: `Avis ${review.source} — ${review.rating}/5`,
      summary: review.content,
      timestamp: review.reviewed_at,
      actor: review.author_name,
      source: 'reviews',
      details: {
        rating: review.rating,
        author: review.author_name,
        content: review.content,
        url: review.review_url,
        response: review.response_text,
        respondedAt: review.responded_at,
      },
    });
  }

  for (const event of input.events ?? []) {
    const meta = domainEventMeta(event);
    if (!meta) continue;

    const ai = isAiEvent(event);
    const payload = event.payload ?? {};
    const summary =
      (typeof payload.message === 'string' && payload.message) ||
      (typeof payload.name === 'string' && payload.name) ||
      (typeof payload.fullName === 'string' && payload.fullName) ||
      null;

    events.push({
      id: `event:${event.id}`,
      category: ai ? 'ai' : meta.category,
      icon: ai ? '🤖' : meta.icon,
      title: meta.title,
      summary,
      timestamp: event.created_at,
      actor: ai ? 'IA' : actorLabel(event.actor_id, currentUserId),
      source: 'domain_events',
      details: {
        eventType: event.event_type,
        payload: event.payload,
        metadata: event.metadata,
      },
    });
  }

  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export async function getClientHistory(
  supabase: SupabaseClient,
  organizationId: string,
  client: Client,
  currentUserId?: string | null
): Promise<ClientTimelineEvent[]> {
  const [visits, messages, campaignSends, loyalty, reviews, events] = await Promise.all([
    listClientVisits(supabase, organizationId, client.id, 200),
    listClientWhatsAppMessages(supabase, organizationId, client.id),
    listClientCampaignSends(supabase, organizationId, client.id),
    listClientLoyaltyTransactions(supabase, organizationId, client.id),
    listClientReviews(supabase, organizationId, client.id),
    listClientDomainEvents(supabase, organizationId, client.id),
  ]);

  return buildClientTimeline({
    client,
    visits,
    messages,
    campaignSends,
    loyalty,
    reviews,
    events,
    currentUserId,
  });
}
