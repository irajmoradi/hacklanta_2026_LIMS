import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: 'fix021.spec.ts', workers: 1, timeout: 60000,
  expect: { timeout: 15000 }, reporter: 'list', outputDir: 'artifacts/fix021/results',
  use: {
    baseURL: 'http://127.0.0.1:5189', trace: 'retain-on-failure',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [1280, 1440].map(width => ({ name: `${width}`, use: { viewport: { width, height: width === 1280 ? 720 : 900 } } })),
  webServer: {
    command: 'bun run dev --port 5189', url: 'http://127.0.0.1:5189', reuseExistingServer: false,
    env: { VITE_MOCK: '1', VITE_DEMO_AUTH: '1', VILLAGE_API_URL: 'http://127.0.0.1:1',
      VILLAGE_ENV_FILE: '/dev/null', VITE_VILLAGE_ID: '', VITE_DEMO_USER: '00000000-0000-4000-8000-000000000001' },
  },
});
