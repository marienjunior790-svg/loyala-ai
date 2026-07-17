import './load-env.js';
import { createServer, type IncomingMessage } from 'node:http';
import { P0_EVENT_TYPES } from '@loyala/events';
import { logStructured, pingHeartbeat } from '@loyala/integrations';
import { bootstrapWorkerAI, handleAIRoute } from './ai-routes.js';
import { validateWorkerEnvAtBoot } from './env.js';
import { inngestHandler } from './inngest/serve.js';
import { isInngestConfigured } from './inngest/client.js';
import { verifyWorkerApiAuth } from './security/api-auth.js';
import { handleWhatsAppSend, whatsAppHealth } from './whatsapp/routes.js';
import {
  handleWhatsAppWebhookPost,
  handleWhatsAppWebhookVerify,
} from './whatsapp/webhook.js';
import {
  billingHealth,
  handleBillingWebhookPost,
} from './billing/routes.js';

const env = validateWorkerEnvAtBoot();
/** Railway injects PORT; local dev uses WORKER_PORT from env schema. */
const PORT = Number(process.env.PORT ?? env.WORKER_PORT);

bootstrapWorkerAI();

function health() {
  return {
    status: 'ok',
    service: 'loyala-worker',
    events: P0_EVENT_TYPES,
    inngest: isInngestConfigured(),
    ai: {
      primary: env.AI_PRIMARY_PROVIDER,
      fallback: env.AI_FALLBACK_PROVIDER,
    },
    whatsapp: whatsAppHealth(),
    billing: billingHealth(),
  };
}

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const raw = await readRawBody(req);
  if (raw.length === 0) return {};
  try {
    return JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const AI_ROUTES = [
  '/ai/segment',
  '/ai/inactive/detect',
  '/ai/inactive/analyze',
  '/ai/campaigns/birthday',
  '/ai/campaigns/loyalty',
  '/ai/campaigns/affinity',
  '/ai/campaigns/promotions',
  '/ai/catalog/generate',
  '/ai/catalog/import',
  '/ai/inbox/reply',
  '/ai/inbox/classify',
  '/ai/rfm/score',
  '/ai/stats',
];

const server = createServer(async (req, res) => {
  const url = req.url ?? '/';
  const pathname = url.split('?')[0] ?? '/';

  if (pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        service: 'loyala-worker',
        status: 'ok',
        health: '/health',
        inngest: '/api/inngest',
        ai: AI_ROUTES,
        whatsapp: {
          sendTest: 'POST /whatsapp/send-test',
          webhook: 'GET|POST /whatsapp/webhook',
        },
        billing: {
          health: 'GET /billing/health',
          webhook: 'POST /billing/webhook',
        },
      })
    );
    return;
  }

  if (pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health()));
    return;
  }

  if (pathname === '/billing/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, ...billingHealth() }));
    return;
  }

  if (pathname === '/billing/webhook' && req.method === 'POST') {
    const rawBody = await readRawBody(req);
    const { status, data } = await handleBillingWebhookPost(rawBody, {
      'x-openpay-signature': req.headers['x-openpay-signature'],
      'x-openpay-webhook-signature': req.headers['x-openpay-webhook-signature'],
      'x-signature': req.headers['x-signature'],
    });
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (pathname === '/api/inngest') {
    await inngestHandler(req, res);
    return;
  }

  if (AI_ROUTES.includes(pathname)) {
    if (!verifyWorkerApiAuth(req.headers)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const body =
      req.method === 'GET'
        ? Object.fromEntries(new URL(url, 'http://localhost').searchParams)
        : await readJsonBody(req);

    try {
      const { status, data } = await handleAIRoute(req.method ?? 'GET', pathname, body);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'AI processing failed',
        })
      );
    }
    return;
  }

  if (pathname === '/whatsapp/send-test' && req.method === 'POST') {
    if (!verifyWorkerApiAuth(req.headers)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    const body = await readJsonBody(req);
    const { status, data } = await handleWhatsAppSend(body);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (pathname === '/whatsapp/webhook') {
    if (req.method === 'GET') {
      const params = new URL(url, 'http://localhost').searchParams;
      const result = handleWhatsAppWebhookVerify(params);
      res.writeHead(result.status, { 'Content-Type': 'text/plain' });
      res.end(result.body);
      return;
    }

    if (req.method === 'POST') {
      const rawBody = await readRawBody(req);
      const { status, data } = await handleWhatsAppWebhookPost(rawBody, {
        'x-hub-signature-256': req.headers['x-hub-signature-256'],
      });
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  logStructured({
    level: 'info',
    service: 'loyala-worker',
    message: 'Worker started',
    context: { port: PORT, inngest: isInngestConfigured() },
  });
  void pingHeartbeat('loyala-worker');
});
