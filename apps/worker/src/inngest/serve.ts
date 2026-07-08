import { serve } from 'inngest/node';
import { inngest } from './client.js';
import { inngestFunctions } from './functions.js';

const signingKey = process.env.INNGEST_SIGNING_KEY?.trim();
const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
const serveOrigin =
  process.env.INNGEST_SERVE_ORIGIN?.trim() ||
  (railwayDomain ? `https://${railwayDomain}` : undefined);

export const inngestHandler = serve({
  client: inngest,
  functions: inngestFunctions,
  ...(signingKey ? { signingKey } : {}),
  ...(serveOrigin ? { serveOrigin } : {}),
});
