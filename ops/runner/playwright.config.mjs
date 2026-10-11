import { defineConfig, devices } from '../../apps/web/node_modules/@playwright/test/index.mjs';
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('../../apps/web/', import.meta.url));
const port = Number(process.env.RUNNER_WEB_PORT || 5189);
export default defineConfig({
  testDir: `${web}/tests`, testMatch: 'auth.spec.ts', workers: 1,
  timeout: 45000, reporter: 'list',
  outputDir: '../../ops/runner/.runtime/test-results/auth',
  use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${port}`,
    screenshot: 'on', trace: 'retain-on-failure' },
  webServer: { command: `bun run dev --port ${port}`, cwd: web,
    url: `http://localhost:${port}`, reuseExistingServer: false, timeout: 60000,
    env: { VITE_MOCK: '0', VITE_DEMO_AUTH: '0', VITE_AUTH0_DOMAIN: 'village-test.auth0.com',
      VITE_AUTH0_CLIENT_ID: 'synthetic-client', VITE_AUTH0_AUDIENCE: 'https://api.village.test',
      VILLAGE_ENV_FILE: process.platform === 'win32' ? 'NUL' : '/dev/null',
      VILLAGE_API_URL: process.env.VILLAGE_API_URL || 'http://127.0.0.1:1' } },
});
