import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  timeout: 120000,
  projects: [{ name: 'web036', testMatch: /(?:web036|feat014).spec.ts/ }],
  webServer: { ...(Array.isArray(base.webServer) ? base.webServer[0] : base.webServer), command: 'bun run dev --port 15386', url: 'http://127.0.0.1:15386' },
  use: { ...base.use, baseURL: 'http://127.0.0.1:15386' },
});

