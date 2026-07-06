import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'packages/**/tests/**/*.test.ts',
      'apps/web/lib/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@loyala/core-iam': resolve(__dirname, 'packages/core-iam/src'),
      '@loyala/db': resolve(__dirname, 'packages/db/src'),
      '@loyala/domain-crm': resolve(__dirname, 'packages/domain-crm/src'),
      '@loyala/events': resolve(__dirname, 'packages/events/src'),
      '@loyala/validation': resolve(__dirname, 'packages/validation/src'),
    },
  },
});
