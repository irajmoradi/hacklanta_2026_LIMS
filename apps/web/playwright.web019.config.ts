import { defineConfig } from '@playwright/test';
import { browserGpuArgs } from './tests/browserGpu';
export default defineConfig({
  testDir:'./tests',testMatch:['web019.spec.ts','web017.spec.ts'],outputDir:'test-results/web019',workers:1,timeout:60000,
  expect:{timeout:15000},reporter:'list',
  use:{baseURL:'http://127.0.0.1:5419',viewport:{width:1440,height:900},video:'on',screenshot:'only-on-failure',trace:'retain-on-failure',launchOptions:{args:browserGpuArgs}},
  webServer:{command:'bun run dev --port 5419',url:'http://127.0.0.1:5419',reuseExistingServer:false,timeout:60000,
    env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:''}},
});
