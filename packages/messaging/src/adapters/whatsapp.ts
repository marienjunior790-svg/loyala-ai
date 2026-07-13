import {
  getMetaWhatsAppConfigFromEnv,
  sendWhatsAppMessage,
  type MetaWhatsAppConfig,
  type SendMessageResult,
} from '@loyala/integrations';
import { buildWhatsAppDeepLink } from '../utils/wa-me';
import { resolveTemplateMapping, routeWhatsAppWithSession } from '../router';
import type {
  DeliveryResult,
  MessagingContext,
  OutboundMessage,
  RouteDecision,
} from '../types';

export interface WhatsAppAdapterDeps {
  sendMessage?: typeof sendWhatsAppMessage;
  getConfig?: () => MetaWhatsAppConfig | null;
}

export async function deliverWhatsApp(
  message: OutboundMessage,
  context: MessagingContext,
  deps: WhatsAppAdapterDeps = {}
): Promise<DeliveryResult> {
  const send = deps.sendMessage ?? sendWhatsAppMessage;
  const config = deps.getConfig?.() ?? getMetaWhatsAppConfigFromEnv() ?? undefined;

  if (!message.optIn) {
    return {
      channel: 'whatsapp',
      mode: 'skipped',
      status: 'skipped',
      skipReason: 'opt_out',
      messageBody: message.body,
    };
  }

  const session = await context.getSession(
    message.organizationId,
    message.clientId,
    'whatsapp'
  );
  const sessionOpen = session?.sessionOpen ?? false;

  let decision: RouteDecision;
  if (!context.apiEnabled || !config) {
    decision = { channel: 'whatsapp', mode: 'deep_link' };
  } else {
    decision = routeWhatsAppWithSession(message, context, sessionOpen);
  }

  if (decision.mode === 'skipped') {
    return {
      channel: 'whatsapp',
      mode: 'skipped',
      status: 'skipped',
      skipReason: decision.skipReason ?? 'skipped',
      messageBody: message.body,
    };
  }

  if (decision.mode === 'deep_link') {
    const deepLinkUrl = buildWhatsAppDeepLink(message.phone, message.body);
    return {
      channel: 'whatsapp',
      mode: 'deep_link',
      status: 'skipped',
      skipReason: sessionOpen ? 'deep_link_unexpected' : 'fallback_deep_link',
      deepLinkUrl,
      messageBody: message.body,
    };
  }

  try {
    let result: SendMessageResult;

    if (decision.mode === 'api_text') {
      result = await send({
        type: 'text',
        phone: message.phone,
        body: message.body,
        config,
      });

      return finalizeApiResult(message, 'api_text', result);
    }

    const mapping = resolveTemplateMapping(message, decision);
    if (!mapping?.ok) {
      const deepLinkUrl = buildWhatsAppDeepLink(message.phone, message.body);
      return {
        channel: 'whatsapp',
        mode: 'deep_link',
        status: 'skipped',
        skipReason: mapping?.reason ?? 'template_mapping_failed',
        deepLinkUrl,
        messageBody: message.body,
      };
    }

    result = await send({
      type: 'template',
      phone: message.phone,
      templateName: mapping.templateName,
      templateLanguage: mapping.templateLanguage,
      templateVariables: mapping.variables.length > 0 ? mapping.variables : undefined,
      body: message.body,
      config,
    });

    const delivery = finalizeApiResult(message, 'api_template', result);
    delivery.templateName = mapping.templateName;
    delivery.templateLanguage = mapping.templateLanguage;
    delivery.templateVariables = mapping.variables;
    return delivery;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      channel: 'whatsapp',
      mode: decision.mode,
      status: 'failed',
      errorMessage,
      messageBody: message.body,
      templateName:
        decision.mode === 'api_template'
          ? decision.template?.providerTemplateName
          : undefined,
    };
  }
}

function finalizeApiResult(
  message: OutboundMessage,
  mode: 'api_text' | 'api_template',
  result: SendMessageResult
): DeliveryResult {
  if (!result.wamid) {
    return {
      channel: 'whatsapp',
      mode,
      status: 'failed',
      errorMessage: result.errorMessage ?? 'Meta response missing wamid',
      messageBody: message.body,
      resolvedPayload: result.raw,
    };
  }

  return {
    channel: 'whatsapp',
    mode,
    status: 'sent',
    externalId: result.wamid,
    messageBody: message.body,
    resolvedPayload: result.raw,
  };
}
