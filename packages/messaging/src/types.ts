export type MessagingChannel = 'whatsapp' | 'sms' | 'email' | 'rcs' | 'messenger';

export type MessageIntent =
  | 'birthday'
  | 'inactive'
  | 'loyalty'
  | 'promo'
  | 'transactional'
  | 'reply';

export type DeliveryMode = 'api_text' | 'api_template' | 'deep_link' | 'skipped';

export type DeliveryStatus = 'queued' | 'sent' | 'failed' | 'skipped';

/** Message métier canonique — jamais couplé à un provider. */
export interface OutboundMessage {
  organizationId: string;
  clientId: string;
  campaignSendId?: string;
  channel: MessagingChannel;
  body: string;
  phone: string;
  optIn: boolean;
  locale?: string;
  intent: MessageIntent;
  metadata?: {
    clientName?: string;
    restaurantName?: string;
    [key: string]: unknown;
  };
}

export interface DeliveryResult {
  channel: MessagingChannel;
  mode: DeliveryMode;
  status: DeliveryStatus;
  externalId?: string;
  resolvedPayload?: unknown;
  skipReason?: string;
  errorMessage?: string;
  deepLinkUrl?: string;
  templateName?: string;
  templateLanguage?: string;
  templateVariables?: string[];
  messageBody?: string;
}

export interface ConversationSession {
  organizationId: string;
  clientId: string;
  channel: MessagingChannel;
  sessionOpen: boolean;
  lastInboundAt?: string;
}

export type TemplateVariableRole =
  | 'first_name'
  | 'body_core'
  | 'restaurant_name'
  | 'offer'
  | 'custom';

export interface TemplateVariableSpec {
  slot: number;
  maxLength: number;
  role: TemplateVariableRole;
}

export interface TemplateCatalogEntry {
  id: string;
  channel: MessagingChannel;
  intent: MessageIntent;
  providerTemplateName: string;
  language: string;
  bodyPattern: string;
  variableCount: number;
  variableSpecs: TemplateVariableSpec[];
  category: 'marketing' | 'utility';
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
}

export interface RouteDecision {
  channel: MessagingChannel;
  mode: DeliveryMode;
  skipReason?: string;
  template?: TemplateCatalogEntry;
}

export interface MessagingContext {
  apiEnabled: boolean;
  templateCatalog: TemplateCatalogEntry[];
  getSession: (
    organizationId: string,
    clientId: string,
    channel: MessagingChannel
  ) => Promise<ConversationSession | null>;
}

export interface TemplateMappingResult {
  ok: boolean;
  templateName: string;
  templateLanguage: string;
  variables: string[];
  reason?: string;
}
