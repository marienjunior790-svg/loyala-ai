import { describe, expect, it } from 'vitest';
import { hasPermission, type AuthContext } from '@loyala/core-iam';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Preuves statiques + IAM pour la frontière consultative MI L1/L2.
 * Aucune écriture production — lecture de sources et assertions RBAC.
 */
describe('MI security boundary (L1/L2)', () => {
  it('analytics:read : owner/admin/manager/viewer OK, staff refusé', () => {
    const roles: AuthContext['role'][] = [
      'org_owner',
      'org_admin',
      'org_manager',
      'org_viewer',
      'org_staff',
    ];
    const allowed = new Set(['org_owner', 'org_admin', 'org_manager', 'org_viewer']);
    for (const role of roles) {
      const ctx: AuthContext = { userId: 'u', organizationId: 'org', role };
      expect(hasPermission(ctx, 'analytics:read')).toBe(allowed.has(role));
    }
  });

  it('sources MI : aucune écriture campaigns / campaign_sends / WhatsApp', () => {
    const roots = [
      resolve(__dirname, '../../../packages/domain-crm/src/mi-tools.ts'),
      resolve(__dirname, '../../../packages/domain-crm/src/mi-opportunities.ts'),
      resolve(__dirname, '../../../packages/domain-crm/src/knowledge/bomaye-advisor.ts'),
      resolve(__dirname, '../../../packages/domain-crm/src/mi-proactive-briefing.ts'),
      resolve(__dirname, '../lib/mi/run-turn.ts'),
      resolve(__dirname, '../app/api/mi/chat/route.ts'),
      resolve(__dirname, '../app/api/mi/insights/route.ts'),
    ];
    const forbidden = [
      /\.from\(\s*['"]campaigns['"]\s*\)\.(insert|update|upsert|delete)/i,
      /\.from\(\s*['"]campaign_sends['"]\s*\)\.(insert|update|upsert|delete)/i,
      /sendWhatsApp|launchCampaign|createCampaign|scheduleCampaign/i,
      /createAdminClient\s*\(|getServiceRoleKey\s*\(|['"]service_role['"]/,
      /INSERT\s+INTO\s+(campaigns|campaign_sends)/i,
      /UPDATE\s+(campaigns|campaign_sends)/i,
      /DELETE\s+FROM\s+(campaigns|campaign_sends)/i,
    ];
    for (const file of roots) {
      const src = readFileSync(file, 'utf8');
      for (const re of forbidden) {
        expect(src, `${file} must not match ${re}`).not.toMatch(re);
      }
    }
  });

  it('route MI n’accepte pas organizationId client comme source de vérité', () => {
    const src = readFileSync(resolve(__dirname, '../app/api/mi/chat/route.ts'), 'utf8');
    expect(src).toContain('ctx.organizationId');
    expect(src).not.toMatch(/organizationId:\s*parsed\.data\.organizationId/);
    expect(src).not.toMatch(/body\.organizationId/);
  });

  it('GET /api/mi/insights : session org + analytics:read, pas d’écriture', () => {
    const src = readFileSync(resolve(__dirname, '../app/api/mi/insights/route.ts'), 'utf8');
    expect(src).toContain("hasPermission(ctx, 'analytics:read')");
    expect(src).toContain('ctx.organizationId');
    expect(src).toContain('loadMiOrgInsights');
    expect(src).not.toMatch(/insert|update|upsert|delete|sendWhatsApp|createCampaign/i);
    expect(src).not.toMatch(/service_role|createAdminClient/);
  });
});
