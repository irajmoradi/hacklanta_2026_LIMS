import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: 'fix006.spec.ts', workers: 1, timeout: 45000,
  outputDir: 'test-results/fix006', reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5186', viewport: {width:1280,height:900},
    launchOptions: {args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']},
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'bun run dev --port 5186', url: 'http://127.0.0.1:5186', reuseExistingServer:false,
    env: {VITE_MOCK:'0', VITE_DEMO_AUTH:'1', VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001', VITE_VILLAGE_ID:''},
  },
});
