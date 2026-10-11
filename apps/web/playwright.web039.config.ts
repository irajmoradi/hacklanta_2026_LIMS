import { defineConfig } from '@playwright/test';
import base from './playwright.web030.config';
export default defineConfig({
  ...base, testMatch: /(?:web039|web030|web037).spec.ts/, outputDir: 'test-results/web039',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5339' },
  webServer: { ...base.webServer as object, command: 'bun run dev --port 5339', url: 'http://127.0.0.1:5339' },
});
