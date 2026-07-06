import { describe, it, expect } from 'vitest';
import {
  computeClientSegment,
  isClientInactive,
  buildWhatsAppUrl,
  extractCampaignMessage,
} from '@loyala/domain-crm';
import { loginSchema, signupSchema, onboardingSchema } from '@loyala/validation';
import { isAllowedAiPath } from '../lib/worker/paths';

/**
 * Smoke tests for the full user journey — validation, domain rules, integrations.
 * Does not require live Supabase (E2E browser tests run separately against production).
 */
describe('User journey smoke tests', () => {
  describe('1. Account creation (signup validation)', () => {
    it('accepts valid signup credentials', () => {
      const result = signupSchema.safeParse({
        email: 'restaurant@test.sn',
        password: 'SecurePass123!',
      });
      expect(result.success).toBe(true);
    });

    it('rejects weak passwords', () => {
      const result = signupSchema.safeParse({
        email: 'restaurant@test.sn',
        password: '123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('2. Login validation', () => {
    it('accepts valid login', () => {
      const result = loginSchema.safeParse({
        email: 'fmagence7@gmail.com',
        password: 'anypassword8',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('3. Onboarding (restaurant setup)', () => {
    it('accepts valid restaurant data', () => {
      const result = onboardingSchema.safeParse({
        organizationName: 'Le Petit Dakar',
        countryCode: 'SN',
        timezone: 'Africa/Dakar',
        currency: 'XOF',
        whatsappPhone: '+221771234567',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty restaurant name', () => {
      const result = onboardingSchema.safeParse({
        organizationName: '',
        countryCode: 'SN',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('4. Clients & segments', () => {
    const vipClient = {
      visit_count: 10,
      last_visit_at: new Date().toISOString(),
      total_spent: 600_000,
      created_at: new Date().toISOString(),
      segment: 'vip',
    };

    const inactiveClient = {
      visit_count: 5,
      last_visit_at: new Date(Date.now() - 40 * 86400000).toISOString(),
      total_spent: 50_000,
      created_at: new Date(Date.now() - 100 * 86400000).toISOString(),
      segment: 'inactive',
    };

    it('classifies VIP clients', () => {
      expect(computeClientSegment(vipClient)).toBe('vip');
    });

    it('detects inactive clients for relance', () => {
      expect(isClientInactive(inactiveClient)).toBe(true);
      expect(computeClientSegment(inactiveClient)).toBe('inactive');
    });

    it('filters segment=vip correctly', () => {
      expect(computeClientSegment(vipClient)).toBe('vip');
      expect(computeClientSegment(inactiveClient)).not.toBe('vip');
    });
  });

  describe('5. Campaigns (IA message extraction)', () => {
    it('extracts message from CampaignPlan shape', () => {
      const plan = {
        clientId: 'abc',
        type: 'loyalty' as const,
        content: { message: 'Bonjour Marie, nous vous attendons !', incentive: '10%' },
      };
      expect(extractCampaignMessage(plan)).toBe('Bonjour Marie, nous vous attendons !');
    });

    it('returns empty for malformed plan (no silent fallback text)', () => {
      expect(extractCampaignMessage({ clientId: 'x', type: 'loyalty', content: { message: '' } })).toBe('');
    });
  });

  describe('6. WhatsApp relances', () => {
    it('builds valid wa.me URL', () => {
      const url = buildWhatsAppUrl('065719922', 'Bonjour test');
      expect(url).toMatch(/^https:\/\/wa\.me\/242/);
      expect(url).toContain('text=');
    });
  });

  describe('7. Worker AI routes allowlist', () => {
    it('allows all journey-critical AI paths', () => {
      expect(isAllowedAiPath('campaigns/loyalty')).toBe(true);
      expect(isAllowedAiPath('campaigns/birthday')).toBe(true);
      expect(isAllowedAiPath('inbox/reply')).toBe(true);
      expect(isAllowedAiPath('segment')).toBe(true);
    });

    it('blocks unknown paths', () => {
      expect(isAllowedAiPath('admin/delete-all')).toBe(false);
    });
  });
});

describe('Production health checks', () => {
  it('login page is reachable', async () => {
    const res = await fetch('https://loyala-ai-web.vercel.app/login', {
      redirect: 'manual',
    });
    expect(res.status).toBeLessThan(500);
  });

  it('health API responds', async () => {
    const res = await fetch('https://loyala-ai-web.vercel.app/api/health');
    expect(res.status).toBeLessThan(500);
    const data = (await res.json()) as { status?: string };
    expect(data.status).toBeDefined();
  });
});
