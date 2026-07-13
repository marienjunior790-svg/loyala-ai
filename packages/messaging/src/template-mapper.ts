import type {
  OutboundMessage,
  TemplateCatalogEntry,
  TemplateMappingResult,
  TemplateVariableRole,
} from './types';

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

function truncate(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 1))}…`;
}

function extractBodyCore(body: string, clientName?: string, restaurantName?: string): string {
  const lines = body
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return body.trim();
  }

  const first = lines[0] ?? '';
  const last = lines[lines.length - 1] ?? '';
  const greeting = clientName ? new RegExp(`bonjour\\s+${firstName(clientName)}`, 'i') : null;
  const signOff = restaurantName
    ? new RegExp(`${restaurantName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
    : null;

  const core = lines.filter((line, index) => {
    if (index === 0 && greeting?.test(line)) return false;
    if (index === lines.length - 1 && signOff?.test(line)) return false;
    return true;
  });

  return core.join(' ').trim() || body.trim();
}

function resolveRoleValue(
  role: TemplateVariableRole,
  message: OutboundMessage
): string {
  const clientName = message.metadata?.clientName ?? '';
  const restaurantName = message.metadata?.restaurantName ?? 'notre restaurant';

  switch (role) {
    case 'first_name':
      return firstName(clientName || 'Client');
    case 'restaurant_name':
      return restaurantName;
    case 'body_core':
    case 'offer':
      return extractBodyCore(message.body, clientName, restaurantName);
    case 'custom':
    default:
      return message.body.trim();
  }
}

export function mapMessageToTemplate(
  message: OutboundMessage,
  template: TemplateCatalogEntry
): TemplateMappingResult {
  if (template.variableCount === 0 || template.variableSpecs.length === 0) {
    return {
      ok: true,
      templateName: template.providerTemplateName,
      templateLanguage: template.language,
      variables: [],
    };
  }

  const variables: string[] = [];
  for (const spec of template.variableSpecs.sort((a, b) => a.slot - b.slot)) {
    const raw = resolveRoleValue(spec.role, message);
    if (!raw) {
      return {
        ok: false,
        templateName: template.providerTemplateName,
        templateLanguage: template.language,
        variables: [],
        reason: `empty_slot_${spec.slot}`,
      };
    }
    variables.push(truncate(raw, spec.maxLength));
  }

  return {
    ok: true,
    templateName: template.providerTemplateName,
    templateLanguage: template.language,
    variables,
  };
}
