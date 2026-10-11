import { defineConfig, devices } from '@playwright/test';
import { browserGpuArgs } from './tests/browserGpu';

export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: browserGpuArgs },
  },
  projects: [
    { name: 'mock', testMatch: /(?:web032|coins|feat009|farm|village|features|audits|polish|equipment|fix003|web015|web017|colors|web025|house).spec.ts/ },
    { name: 'auth', testMatch: 'auth.spec.ts', use: { baseURL: 'http://localhost:5177' } },
    { name: 'connection', testMatch: /(?:connection|settings|heads|web015-live).spec.ts/, use: { baseURL: 'http://127.0.0.1:5175' } },
  ],
  webServer: [{
    command: 'bun run dev --port 5174',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    // A live village override must never break the forced offline fixture world.
    env: { VITE_MOCK: '1', VITE_DEMO_AUTH: '1', VITE_DEMO_USER: '00000000-0000-4000-8000-000000000001', VITE_VILLAGE_ID: '13370000-0000-4000-8000-000000000000' },
    timeout: 60000,
  }, {
    command: 'bun run dev --port 5175',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
    env: { VITE_MOCK: '0', VITE_DEMO_AUTH: '1', VITE_DEMO_USER: '00000000-0000-4000-8000-000000000001', VITE_VILLAGE_ID: '' },
    timeout: 60000,
  }, {
    command: 'bun run dev --port 5177', url: 'http://localhost:5177', reuseExistingServer: false,
    env: { VITE_MOCK: '0', VITE_DEMO_AUTH: '0', VITE_AUTH0_DOMAIN: 'village-test.auth0.com', VITE_AUTH0_CLIENT_ID: 'synthetic-client', VITE_AUTH0_AUDIENCE: 'https://api.village.test' }, timeout: 60000,
  }],
});
