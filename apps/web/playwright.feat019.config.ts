import { defineConfig } from '@playwright/test';
import base from './playwright.feat016.config';

if (!process.env.VILLAGE_API_URL || /:8010\b/.test(process.env.VILLAGE_API_URL)) {
  throw new Error('FEAT-019 requires the remote runner --with-api disposable API');
}
export default defineConfig({
  ...base,
  testMatch: 'feat019.spec.ts',
  outputDir: 'test-results/feat019',
  use: {...base.use, baseURL:'http://127.0.0.1:5199', video:'on'},
  webServer: {
    command:'bun run dev --port 5199', url:'http://127.0.0.1:5199', reuseExistingServer:false,
    env:{VITE_MOCK:'0', VITE_DEMO_AUTH:'1', VITE_DEMO_USER:'13370000-0000-4000-8000-000000000001'},
  },
});
