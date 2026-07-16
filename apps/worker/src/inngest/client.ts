import { Inngest } from 'inngest';
import { getWorkerEnv } from '../env.js';

function trimEnv(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

// Railway/Vercel CLI can inject trailing newlines — breaks Inngest signature validation.
for (const key of ['INNGEST_EVENT_KEY', 'INNGEST_SIGNING_KEY'] as const) {
  const v = trimEnv(key);
  if (v) process.env[key] = v;
}

export const inngest = new Inngest({
  id: 'loyala-worker',
  eventKey: process.env.INNGEST_EVENT_KEY,
  isDev: process.env.INNGEST_DEV === 'true' || process.env.NODE_ENV !== 'production',
});

export const INNGEST_EVENTS = {
  BIRTHDAY_RUN: 'loyala/campaign.birthday.run',
  INACTIVE_RUN: 'loyala/campaign.inactive.run',
  DISPATCH_DAILY: 'loyala/cron.daily.dispatch',
  SCHEDULED_RUN: 'loyala/campaign.scheduled.run',
  /** Bridge from domain_events audit → async consumers */
  DOMAIN_EVENT: 'loyala/domain.event',
  BILLING_PAYMENT_POLL: 'loyala/billing.payment.poll',
  BILLING_RENEWAL: 'loyala/billing.renewal',
} as const;

export function isInngestConfigured(): boolean {
  const env = getWorkerEnv();
  return Boolean(env.INNGEST_EVENT_KEY) || env.INNGEST_DEV;
}
