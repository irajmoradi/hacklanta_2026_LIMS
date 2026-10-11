import { defineConfig, devices } from '@playwright/test';
import { browserGpuArgs } from './tests/browserGpu';

export default defineConfig({
  testDir: './tests', testMatch: 'web029.spec.ts', workers: 1, timeout: 120000,
  outputDir: 'test-results/web029', reporter: 'list', expect: {timeout: 30000},
  use: {...devices['Desktop Chrome'], viewport: {width:1440,height:1000},
    baseURL:'http://127.0.0.1:5299', launchOptions:{args:browserGpuArgs}},
  webServer:{command:'bun run dev --port 5299',url:'http://127.0.0.1:5299',reuseExistingServer:false,
    env:{VITE_MOCK:'0',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'13370000-0000-4000-8000-000000000001',
      VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000',VILLAGE_API_URL:'http://127.0.0.1:8029'}},
});
