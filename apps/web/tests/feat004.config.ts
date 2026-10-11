import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  timeout: 60000, expect: {timeout: 15000}, testDir: '.', testMatch: 'feat004.spec.ts', outputDir: '../test-results/feat004', workers: 1,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5194', launchOptions: {args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']} },
  webServer: {command: 'bun run dev --port 5194', url: 'http://127.0.0.1:5194', env: {VITE_MOCK: '1', VITE_DEMO_AUTH: '1'}, timeout: 60000},
});
