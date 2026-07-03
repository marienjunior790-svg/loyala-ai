import { Inngest } from 'inngest';
import { getWorkerEnv } from '../env.js';

export const inngest = new Inngest({
  id: 'loyala-worker',
  eventKey: process.env.INNGEST_EVENT_KEY,
  isDev: process.env.INNGEST_DEV === 'true' || process.env.NODE_ENV !== 'production',
});

export const INNGEST_EVENTS = {
  BIRTHDAY_RUN: 'loyala/campaign.birthday.run',
  INACTIVE_RUN: 'loyala/campaign.inactive.run',
  DISPATCH_DAILY: 'loyala/cron.daily.dispatch',
} as const;

export function isInngestConfigured(): boolean {
  const env = getWorkerEnv();
  return Boolean(env.INNGEST_EVENT_KEY) || env.INNGEST_DEV;
}
