import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'fix008.spec.ts', workers: 1, timeout: 600000,
  outputDir: 'test-results/fix008', reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5298',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: { command: 'bun run dev --port 5298', url: 'http://127.0.0.1:5298', reuseExistingServer: true,
    env: { VITE_MOCK: '0', VITE_DEMO_AUTH: '1', VITE_DEMO_USER: '13370000-0000-4000-8000-000000000001',
      VILLAGE_API_URL: process.env.VILLAGE_API_URL ?? 'http://127.0.0.1:8010' } },
});
