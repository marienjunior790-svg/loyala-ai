import { describe, expect, it } from 'vitest';
import { templateEntriesFromDbRows } from './catalog-from-rows';

describe('templateEntriesFromDbRows', () => {
  it('maps snake_case DB fields to TemplateCatalogEntry', () => {
    const [entry] = templateEntriesFromDbRows([
      {
        id: 'x',
        intent: 'birthday',
        provider_template_name: 'loyala_birthday_v1',
        language: 'fr',
        body_pattern: 'Hi {{1}}',
        variable_count: 1,
        variable_specs: [{ slot: 1, maxLength: 60, role: 'first_name' }],
        category: 'marketing',
        status: 'approved',
      },
    ]);
    expect(entry?.providerTemplateName).toBe('loyala_birthday_v1');
    expect(entry?.channel).toBe('whatsapp');
  });
});
