import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base,
  timeout: 120000,
  outputDir: 'test-results/fix014',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5398' },
  projects: [{ name: 'profile-layout', testMatch: 'fix014.spec.ts' }],
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5398', url: 'http://127.0.0.1:5398', reuseExistingServer: false,
    env: { VITE_MOCK: '1', VITE_DEMO_AUTH: '1' } },
});
