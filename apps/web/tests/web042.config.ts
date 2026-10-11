import { defineConfig, devices } from '@playwright/test';
import { browserGpuArgs } from './browserGpu';
export default defineConfig({
  testDir: '.', testMatch: /(?:web042|feat016)\.spec\.ts/, workers: 1, timeout: 180000,
  expect: { timeout: 20000 }, reporter: [['list'], ['json', { outputFile: 'artifacts/web042/results.json' }]], outputDir: '../test-results/web042',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5242', viewport: { width: 1440, height: 1000 },
    launchOptions: { args: browserGpuArgs }, screenshot: 'only-on-failure' },
  webServer: { command: 'bun run dev --port 5242', url: 'http://127.0.0.1:5242', reuseExistingServer: false,
    env: { VITE_MOCK: '1', VITE_DEMO_AUTH: '1', VITE_VILLAGE_ID: '', VITE_DEMO_USER: '00000000-0000-4000-8000-000000000001' } },
});
