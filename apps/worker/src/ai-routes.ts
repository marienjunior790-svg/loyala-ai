import {

  bootstrapAI,

  getMemoryLogger,

  createAutomationService,

  getAITokenStats,

  getAIMetrics,

  setAILogger,

  CompositeAILogger,

  ConsoleAILogger,

} from '@loyala/core-ai';

import { getWorkerAdminClient } from './supabase.js';



let bootstrapped = false;



export function bootstrapWorkerAI(): void {

  if (bootstrapped) return;



  const admin = getWorkerAdminClient();

  bootstrapAI({ supabaseAdmin: admin, enableConsole: true });

  setAILogger(

    new CompositeAILogger([new ConsoleAILogger(), getMemoryLogger()])

  );

  bootstrapped = true;

}



export async function getWorkerAIStats(organizationId?: string) {

  if (organizationId) {

    const metrics = await getAIMetrics(organizationId);

    if (metrics) return metrics;

  }

  return getAITokenStats(organizationId);

}



export async function handleAIRoute(

  method: string,

  pathname: string,

  body: Record<string, unknown>

): Promise<{ status: number; data: unknown }> {

  bootstrapWorkerAI();



  if (method === 'GET' && pathname === '/ai/stats') {

    const orgId = body.organizationId as string | undefined;

    return { status: 200, data: await getWorkerAIStats(orgId) };

  }



  if (method !== 'POST') {

    return { status: 405, data: { error: 'Method not allowed' } };

  }



  const organizationId = body.organizationId as string;

  if (!organizationId) {

    return { status: 400, data: { error: 'organizationId required' } };

  }



  const automation = createAutomationService(organizationId);



  switch (pathname) {

    case '/ai/segment': {

      const clients = body.clients as Parameters<typeof automation.segmentClients>[0];

      if (!Array.isArray(clients)) {

        return { status: 400, data: { error: 'clients array required' } };

      }

      const results = await automation.segmentClients(clients);

      return { status: 200, data: { results } };

    }



    case '/ai/inactive/detect': {

      const clients = body.clients as Parameters<typeof automation.detectInactive>[0];

      const days = (body.inactiveDays as number) ?? 14;

      return { status: 200, data: { inactive: automation.detectInactive(clients, days) } };

    }



    case '/ai/inactive/analyze': {

      const client = body.client as Parameters<typeof automation.analyzeInactive>[0];

      const analysis = await automation.analyzeInactive(client);

      return { status: 200, data: { analysis } };

    }



    case '/ai/campaigns/birthday': {

      const clients = body.clients as Parameters<typeof automation.runBirthdayCampaigns>[0];

      const restaurantName = (body.restaurantName as string) ?? 'Restaurant';

      const plans = await automation.runBirthdayCampaigns(

        clients,

        restaurantName,

        body.offer as string

      );

      return { status: 200, data: { campaigns: plans } };

    }



    case '/ai/campaigns/loyalty': {

      const clients = body.clients as Parameters<typeof automation.runLoyaltyRelances>[0];

      const plans = await automation.runLoyaltyRelances(clients);

      return { status: 200, data: { campaigns: plans } };

    }



    case '/ai/campaigns/affinity': {

      const clients = body.clients as Parameters<typeof automation.runAffinityRelances>[0];

      const plans = await automation.runAffinityRelances(clients);

      return { status: 200, data: { campaigns: plans } };

    }



    case '/ai/catalog/generate': {

      const result = await automation.generateCatalog({

        brief: (body.brief as string) ?? '',

        establishmentType: body.establishmentType as string | undefined,

        currency: body.currency as string | undefined,

        existingCategories: Array.isArray(body.existingCategories)

          ? (body.existingCategories as string[])

          : undefined,

      });

      return { status: 200, data: result };

    }



    case '/ai/campaigns/promotions': {

      const context = (body.context as Record<string, unknown>) ?? {};

      const suggestions = await automation.suggestPromotions(context);

      return { status: 200, data: suggestions };

    }



    case '/ai/inbox/reply': {

      const reply = await automation.generateReply({

        message: body.message as string,

        clientName: body.clientName as string,

        restaurantName: body.restaurantName as string,

        context: body.context as string,

      });

      return { status: 200, data: reply };

    }



    case '/ai/inbox/classify': {

      const result = await automation.classifyMessage({

        messageId: (body.messageId as string) ?? 'unknown',

        text: body.text as string,

        channel: body.channel as string,

      });

      return { status: 200, data: result };

    }



    case '/ai/rfm/score': {

      const clients = body.clients as Parameters<typeof automation.scoreRFM>[0];

      return { status: 200, data: { scores: automation.scoreRFM(clients) } };

    }



    default:

      return { status: 404, data: { error: 'Unknown AI route' } };

  }

}


