import { defineConfig, devices } from '@playwright/test';
import { browserGpuArgs } from './tests/browserGpu';

export default defineConfig({
  testDir: './tests', testMatch: 'web033.spec.ts', workers: 1, timeout: 120000,
  outputDir: 'test-results/web033', reporter: 'list', expect: {timeout: 30000},
  use: {...devices['Desktop Chrome'], viewport: {width:1440,height:1000},
    baseURL:'http://127.0.0.1:5333', launchOptions:{args:browserGpuArgs}},
  webServer:{command:'bun run dev --port 5333',url:'http://127.0.0.1:5333',reuseExistingServer:false,
    env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',
      VITE_VILLAGE_ID:'00000000-0000-4000-8000-000000000000',VILLAGE_API_URL:'http://127.0.0.1:8029'}},
});
