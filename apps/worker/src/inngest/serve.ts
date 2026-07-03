import { serve } from 'inngest/node';
import { inngest } from './client.js';
import { inngestFunctions } from './functions.js';

export const inngestHandler = serve({
  client: inngest,
  functions: inngestFunctions,
});
