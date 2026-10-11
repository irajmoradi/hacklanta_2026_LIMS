import { browserGpuArgs } from './tests/browserGpu';
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'feat016.spec.ts', workers: 1, timeout: 90000,
  expect: { timeout: 20000 }, reporter: 'list', outputDir: 'test-results/feat016',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5196', viewport: {width:1440,height:1000},
    launchOptions: { args: browserGpuArgs },
    screenshot: 'only-on-failure', video: 'on' },
  webServer: { command: 'bun run dev --port 5196', url: 'http://127.0.0.1:5196', reuseExistingServer: false,
    env: { VITE_MOCK:'1', VITE_DEMO_AUTH:'1', VITE_VILLAGE_ID:'', VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001' } },
});
