import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: 'real.spec.ts', workers: 1, timeout: 45000,
  reporter: 'list', outputDir: 'test-results/real',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5176', headless: false, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
  webServer: { command: 'bun run dev --port 5176', url: 'http://127.0.0.1:5176', reuseExistingServer: false,
    env: { VITE_MOCK: '0', VITE_DEMO_AUTH: '1', VITE_DEMO_USER: '13370000-0000-4000-8000-000000000001', VITE_VILLAGE_ID: '13370000-0000-4000-8000-000000000000' } },
});
