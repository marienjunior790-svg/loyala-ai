import './load-env.js';
import { createServer, type IncomingMessage } from 'node:http';
import { P0_EVENT_TYPES } from '@loyala/events';
import { bootstrapWorkerAI, handleAIRoute } from './ai-routes.js';
import { validateWorkerEnvAtBoot } from './env.js';
import { inngestHandler } from './inngest/serve.js';
import { isInngestConfigured } from './inngest/client.js';
import { verifyWorkerApiAuth } from './security/api-auth.js';

const env = validateWorkerEnvAtBoot();
const PORT = env.WORKER_PORT;

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
  };
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
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
  '/ai/campaigns/promotions',
  '/ai/inbox/reply',
  '/ai/inbox/classify',
  '/ai/rfm/score',
  '/ai/stats',
];

const server = createServer(async (req, res) => {
  const url = req.url ?? '/';
  const pathname = url.split('?')[0] ?? '/';

  if (pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health()));
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

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`[worker] :${PORT} — /health, /api/inngest, AI routes`);
});
