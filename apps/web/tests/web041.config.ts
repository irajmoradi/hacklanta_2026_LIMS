import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir: '.', testMatch: 'web041.spec.ts', workers: 1, timeout: 90000,
  outputDir: '../test-results/web041', reporter: 'list', expect: {timeout:15000},
  use: { baseURL: 'http://127.0.0.1:5191', trace: 'retain-on-failure',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: { command: 'bun run dev --port 5191', cwd: fileURLToPath(new URL('../', import.meta.url)), url: 'http://127.0.0.1:5191', reuseExistingServer: false,
    env: { VITE_MOCK:'1', VITE_DEMO_AUTH:'1', VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001', VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000', VILLAGE_ENV_FILE:'/dev/null', VILLAGE_API_URL:'http://127.0.0.1:1' } },
});
