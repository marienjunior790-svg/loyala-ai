import { describe, expect, it } from 'vitest';
import { findTemplateForIntent, resolveTemplateCatalog } from './template-catalog';
import { mapMessageToTemplate } from './template-mapper';
import type { OutboundMessage } from './types';

const message: OutboundMessage = {
  organizationId: 'org-1',
  clientId: 'client-1',
  channel: 'whatsapp',
  body: 'Bonjour Marie !\n\nVous n\'êtes pas venue depuis un moment.\nCette semaine nous vous offrons un dessert.\n\nÀ bientôt chez Restaurant Soleil.',
  phone: '065719922',
  optIn: true,
  intent: 'inactive',
  metadata: {
    clientName: 'Marie Dupont',
    restaurantName: 'Restaurant Soleil',
  },
};

describe('mapMessageToTemplate', () => {
  it('maps business message into template variables', () => {
    const template = findTemplateForIntent(resolveTemplateCatalog(), 'inactive');
    expect(template).toBeDefined();

    const mapping = mapMessageToTemplate(message, template!);
    expect(mapping.ok).toBe(true);
    expect(mapping.variables[0]).toBe('Marie');
    expect(mapping.variables[1]).toContain('dessert');
    expect(mapping.variables[2]).toBe('Restaurant Soleil');
  });

  it('keeps per-intent provider names when env override is absent', () => {
    const catalog = resolveTemplateCatalog({});
    expect(findTemplateForIntent(catalog, 'inactive')?.providerTemplateName).toBe(
      'loyala_inactive_v1'
    );
    expect(findTemplateForIntent(catalog, 'birthday')?.providerTemplateName).toBe(
      'loyala_birthday_v1'
    );
  });

  it('applies env template name override via catalog resolver', () => {
    const catalog = resolveTemplateCatalog({
      templateName: 'custom_inactive_fr',
      templateLanguage: 'fr',
    });
    const template = findTemplateForIntent(catalog, 'inactive');
    expect(template?.providerTemplateName).toBe('custom_inactive_fr');
  });
});
