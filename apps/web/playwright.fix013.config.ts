import { defineConfig } from '@playwright/test';
import config from './playwright.config';
const server = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer!;
export default defineConfig({ ...config,
  use: { ...config.use, baseURL: 'http://127.0.0.1:5395' },
  projects: [{ name: 'mock', testMatch: /(?:fix013|audits).spec.ts/ }],
  webServer: { ...server, command: 'bun run dev --port 5395', url: 'http://127.0.0.1:5395' },
});
