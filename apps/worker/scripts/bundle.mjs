import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const outFile = fileURLToPath(new URL('../dist/server.mjs', import.meta.url));
mkdirSync(dirname(outFile), { recursive: true });

await esbuild.build({
  entryPoints: [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: outFile,
  sourcemap: true,
  // Keep native/optional deps external — installed in node_modules at runtime
  external: ['inngest'],
  logLevel: 'info',
});

console.log('Worker bundle:', outFile);
