import { browserGpuArgs } from './tests/browserGpu';
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:'feat009-real.spec.ts',workers:1,timeout:240000,
  outputDir:'test-results/feat009-real-traces',reporter:'list',expect:{timeout:30000},
  use:{...devices['Desktop Chrome'],launchOptions:{args:browserGpuArgs},baseURL:'http://127.0.0.1:5496',viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'bun run dev --port 5496',url:'http://127.0.0.1:5496',reuseExistingServer:false,
    env:{VITE_MOCK:'0',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'13370000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000',VILLAGE_API_URL:process.env.VILLAGE_API_URL ?? 'http://127.0.0.1:8029'}},
});
