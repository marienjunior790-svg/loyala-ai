import { describe, expect, it, vi, beforeEach } from 'vitest';
import { templateEntriesFromDbRows } from '@loyala/messaging';
import { loadTemplateCatalog } from './load-catalog';
import { PLATFORM_TEMPLATE_CATALOG } from '@loyala/messaging';

vi.mock('@loyala/domain-crm', () => ({
  listApprovedWhatsAppTemplateRows: vi.fn(),
}));

import { listApprovedWhatsAppTemplateRows } from '@loyala/domain-crm';

const mockSupabase = {} as never;

describe('templateEntriesFromDbRows', () => {
  it('maps DB rows', () => {
    const entries = templateEntriesFromDbRows([
      {
        id: 'id-1',
        intent: 'inactive',
        provider_template_name: 'loyala_inactive_v1',
        language: 'fr',
        body_pattern: 'Bonjour {{1}}',
        variable_count: 1,
        variable_specs: [{ slot: 1, maxLength: 60, role: 'first_name' }],
        category: 'marketing',
        status: 'approved',
      },
    ]);
    expect(entries[0]?.providerTemplateName).toBe('loyala_inactive_v1');
  });
});

describe('loadTemplateCatalog', () => {
  beforeEach(() => {
    vi.mocked(listApprovedWhatsAppTemplateRows).mockReset();
  });

  it('uses DB when approved rows exist', async () => {
    vi.mocked(listApprovedWhatsAppTemplateRows).mockResolvedValue([
      {
        id: 'db-1',
        organization_id: null,
        channel: 'whatsapp',
        intent: 'inactive',
        provider_template_name: 'loyala_inactive_v1',
        language: 'fr',
        body_pattern: 'Bonjour {{1}}. {{2}} — {{3}}',
        variable_count: 3,
        variable_specs: [
          { slot: 1, maxLength: 60, role: 'first_name' },
          { slot: 2, maxLength: 200, role: 'body_core' },
          { slot: 3, maxLength: 60, role: 'restaurant_name' },
        ],
        category: 'marketing',
        status: 'approved',
        approved_at: '2026-01-01',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ]);

    const catalog = await loadTemplateCatalog(mockSupabase, { organizationId: 'org-1' });
    expect(catalog.some((t) => t.intent === 'inactive')).toBe(true);
  });

  it('falls back to platform catalog', async () => {
    vi.mocked(listApprovedWhatsAppTemplateRows).mockResolvedValue([]);
    const catalog = await loadTemplateCatalog(mockSupabase);
    expect(catalog.length).toBe(PLATFORM_TEMPLATE_CATALOG.length);
  });
});
