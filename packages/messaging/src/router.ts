import { findTemplateForIntent } from './template-catalog';
import { mapMessageToTemplate } from './template-mapper';
import type {
  MessagingContext,
  OutboundMessage,
  RouteDecision,
  TemplateMappingResult,
} from './types';

export async function routeOutboundMessage(
  message: OutboundMessage,
  context: MessagingContext
): Promise<RouteDecision> {
  if (!message.optIn) {
    return {
      channel: message.channel,
      mode: 'skipped',
      skipReason: 'opt_out',
    };
  }

  if (!context.apiEnabled && message.channel === 'whatsapp') {
    return {
      channel: message.channel,
      mode: 'deep_link',
    };
  }

  if (message.channel !== 'whatsapp') {
    return {
      channel: message.channel,
      mode: 'skipped',
      skipReason: 'channel_not_implemented',
    };
  }

  const session = await context.getSession(
    message.organizationId,
    message.clientId,
    'whatsapp'
  );

  return routeWhatsAppWithSession(message, context, session?.sessionOpen ?? false);
}

export function routeWhatsAppWithSession(
  message: OutboundMessage,
  context: MessagingContext,
  sessionOpen: boolean
): RouteDecision {
  if (sessionOpen) {
    return { channel: 'whatsapp', mode: 'api_text' };
  }

  const template = findTemplateForIntent(context.templateCatalog, message.intent);
  if (template) {
    const mapping = mapMessageToTemplate(message, template);
    if (mapping.ok) {
      return { channel: 'whatsapp', mode: 'api_template', template };
    }
  }

  return { channel: 'whatsapp', mode: 'deep_link' };
}

export function resolveTemplateMapping(
  message: OutboundMessage,
  decision: RouteDecision
): TemplateMappingResult | null {
  if (decision.mode !== 'api_template' || !decision.template) {
    return null;
  }
  return mapMessageToTemplate(message, decision.template);
}
