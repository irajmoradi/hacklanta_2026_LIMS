import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'web023.spec.ts', workers: 1,
  outputDir: 'test-results/web023-run', reporter: 'list',
  webServer: {
    command: 'bun run dev --port 5323', url: 'http://127.0.0.1:5323', reuseExistingServer: false,
    env: {VITE_MOCK: '0', VITE_DEMO_AUTH: '1', VITE_DEMO_USER: '13370000-0000-4000-8000-000000000001', VITE_VILLAGE_ID: '13370000-0000-4000-8000-000000000000'},
  },
});
