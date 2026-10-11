import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir: '.', testMatch: 'fix020.spec.ts', outputDir: '../artifacts/fix020/runs', workers: 1, timeout: 90000,
  use: { baseURL: 'http://127.0.0.1:5196', viewport: {width: 844, height: 390},
    launchOptions: {args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']} },
  webServer: { command: 'bun run dev --port 5196', cwd: fileURLToPath(new URL('..',import.meta.url)), url: 'http://127.0.0.1:5196',
    env: {VITE_MOCK:'1', VITE_DEMO_AUTH:'1', VILLAGE_API_URL:'http://127.0.0.1:1',
      VILLAGE_ENV_FILE:'/dev/null', VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000'} },
});
