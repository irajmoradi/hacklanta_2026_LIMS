import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'feat017.spec.ts', workers: 1, timeout: 120000,
  outputDir: 'test-results/feat017', reporter: 'list',
  expect: {timeout: 15000},
  use: {baseURL: 'http://127.0.0.1:5187', hasTouch: true, viewport: {width: 1280, height: 900}, video: 'on', screenshot: 'only-on-failure', trace: 'retain-on-failure',
    launchOptions: {args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']}},
  webServer: {command: 'bun run dev --config vite.feat017.config.ts --port 5187', url: 'http://127.0.0.1:5187', reuseExistingServer: false, timeout: 60000,
    env: {VITE_MOCK: '0', VITE_DEMO_AUTH: '1', VITE_DEMO_USER: '00000000-0000-4000-8000-000000000001', VITE_VILLAGE_ID: ''}},
});
