import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'feat020.spec.ts', workers: 1, timeout: 120000,
  use: { baseURL: 'http://127.0.0.1:5188', viewport: {width: 1440, height: 1000}, launchOptions: {args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']} },
  webServer: {command: 'bun run dev --port 5188', url: 'http://127.0.0.1:5188', reuseExistingServer: false,
    env: {VITE_MOCK: '1', VITE_DEMO_AUTH: '1', VITE_VILLAGE_ID: '', VILLAGE_ENV_FILE: '/dev/null', VILLAGE_API_URL: 'http://127.0.0.1:1'}},
});
