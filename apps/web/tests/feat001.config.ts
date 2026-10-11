import { defineConfig } from '@playwright/test';

const real = process.env.FEAT001_REAL === '1';
export default defineConfig({
  testDir: '.', testMatch: 'feat001.spec.ts', outputDir: '../test-results/feat001',
  workers: 1, timeout: 120000, expect: {timeout: 15000}, reporter: 'list',
  use: {baseURL: 'http://127.0.0.1:5201', viewport: {width: 1440, height: 1000}, contextOptions: {reducedMotion: 'reduce'},
    launchOptions: {args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']},
    screenshot: 'only-on-failure', trace: 'retain-on-failure'},
  webServer: {command: 'bun run dev --port 5201', url: 'http://127.0.0.1:5201', reuseExistingServer: false,
    env: {VITE_MOCK: real ? '0' : '1', VITE_DEMO_AUTH: '1', VITE_AUTH0_DOMAIN: '', VITE_AUTH0_CLIENT_ID: '',
      VITE_DEMO_USER: real ? '13370000-0000-4000-8000-000000000001' : '00000000-0000-4000-8000-000000000001',
      VITE_VILLAGE_ID: '13370000-0000-4000-8000-000000000000', VILLAGE_API_URL: 'http://127.0.0.1:8021'}, timeout: 60000},
});
