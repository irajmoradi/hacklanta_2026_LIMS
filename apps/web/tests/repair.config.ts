import { defineConfig } from '@playwright/test';
import base from './lab.config';
export default defineConfig({
  ...base,
  testMatch: ['repair.spec.ts', 'lab.spec.ts'],
  outputDir: 'test-results/feat028',
  use: {...base.use, baseURL: 'http://127.0.0.1:5278'},
  webServer: {
    ...base.webServer as object,
    command: 'bun run dev --port 5278',
    url: 'http://127.0.0.1:5278',
  },
});
