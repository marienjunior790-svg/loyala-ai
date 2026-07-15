import { inngest, INNGEST_EVENTS } from './client.js';
import {
  listActiveOrganizations,
  runBirthdayCampaignForOrg,
  runInactiveRelaunchForOrg,
} from '../jobs/campaign-jobs.js';
import { runAllDueScheduledCampaigns } from '../jobs/scheduled-campaign-jobs.js';

const BATCH_SIZE = 5;

/** Daily dispatcher — fans out per-tenant jobs (isolation stricte) */
export const dailyCampaignDispatcher = inngest.createFunction(
  {
    id: 'loyala-daily-campaign-dispatcher',
    retries: 2,
  },
  { cron: '0 8 * * *' },
  async ({ step }) => {
    const orgs = await step.run('list-organizations', listActiveOrganizations);

    await step.sendEvent(
      'fan-out-birthday',
      orgs.map((org) => ({
        name: INNGEST_EVENTS.BIRTHDAY_RUN,
        data: { organizationId: org.id, restaurantName: org.name },
      }))
    );

    await step.sendEvent(
      'fan-out-inactive',
      orgs.map((org) => ({
        name: INNGEST_EVENTS.INACTIVE_RUN,
        data: { organizationId: org.id, inactiveDays: 30 },
      }))
    );

    return { organizations: orgs.length };
  }
);

/** Per-tenant birthday campaigns — batching + retry Inngest */
export const birthdayCampaignJob = inngest.createFunction(
  {
    id: 'loyala-birthday-campaign',
    retries: 3,
    concurrency: { limit: BATCH_SIZE },
  },
  { event: INNGEST_EVENTS.BIRTHDAY_RUN },
  async ({ event, step }) => {
    const { organizationId, restaurantName } = event.data as {
      organizationId: string;
      restaurantName: string;
    };

    if (!organizationId) {
      throw new Error('organizationId required');
    }

    const result = await step.run(`birthday-${organizationId}`, () =>
      runBirthdayCampaignForOrg(organizationId, restaurantName ?? 'Restaurant')
    );

    return result;
  }
);

/** Per-tenant inactive relaunch — RFM + IA */
export const inactiveRelaunchJob = inngest.createFunction(
  {
    id: 'loyala-inactive-relaunch',
    retries: 3,
    concurrency: { limit: BATCH_SIZE },
  },
  { event: INNGEST_EVENTS.INACTIVE_RUN },
  async ({ event, step }) => {
    const { organizationId, inactiveDays } = event.data as {
      organizationId: string;
      inactiveDays?: number;
    };

    if (!organizationId) {
      throw new Error('organizationId required');
    }

    const result = await step.run(`inactive-${organizationId}`, () =>
      runInactiveRelaunchForOrg(organizationId, inactiveDays ?? 30)
    );

    return result;
  }
);

/** User-scheduled campaigns — materialize sends when scheduled_at is due */
export const scheduledCampaignExecutor = inngest.createFunction(
  {
    id: 'loyala-scheduled-campaign-executor',
    retries: 2,
  },
  { cron: '*/15 * * * *' },
  async ({ step }) => {
    const result = await step.run('execute-due-scheduled-campaigns', runAllDueScheduledCampaigns);
    return result;
  }
);

/** Observability / future fan-out for domain_events bridge */
export const domainEventConsumer = inngest.createFunction(
  {
    id: 'loyala-domain-event-consumer',
    retries: 1,
  },
  { event: INNGEST_EVENTS.DOMAIN_EVENT },
  async ({ event, step }) => {
    const data = event.data as {
      eventType?: string;
      organizationId?: string;
      aggregateId?: string;
    };

    await step.run('ack-domain-event', async () => ({
      eventType: data.eventType ?? 'unknown',
      organizationId: data.organizationId ?? null,
      aggregateId: data.aggregateId ?? null,
      acknowledgedAt: new Date().toISOString(),
    }));

    return { ok: true, eventType: data.eventType };
  }
);

export const inngestFunctions = [
  dailyCampaignDispatcher,
  birthdayCampaignJob,
  inactiveRelaunchJob,
  scheduledCampaignExecutor,
  domainEventConsumer,
];
