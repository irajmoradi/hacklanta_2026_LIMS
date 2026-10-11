import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: 'fix005-real.spec.ts', workers: 1, timeout: 180000,
  outputDir: 'test-results/fix005-run', reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5295', viewport: { width: 1200, height: 760 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: { command: 'bun run dev --port 5295', url: 'http://127.0.0.1:5295', reuseExistingServer: false,
    env: { VITE_MOCK: '0', VITE_DEMO_AUTH: '1', VITE_DEMO_USER: '13370000-0000-4000-8000-000000000001',
      VILLAGE_API_URL: process.env.VILLAGE_API_URL ?? 'http://127.0.0.1:8010' } },
});
