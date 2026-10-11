import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'feat018.spec.ts', workers: 1, timeout: 90000,
  expect: { timeout: 20000 }, reporter: 'list', outputDir: 'test-results/feat018',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5198', viewport: { width: 1440, height: 1000 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }, screenshot: 'only-on-failure' },
  webServer: { command: 'bun run dev --port 5198', url: 'http://127.0.0.1:5198', reuseExistingServer: false,
    env: { VITE_MOCK: '1', VITE_DEMO_AUTH: '1', VITE_VILLAGE_ID: '', VITE_DEMO_USER: '00000000-0000-4000-8000-000000000001' } },
});
