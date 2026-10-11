import { defineConfig, devices } from '@playwright/test';
import { browserGpuArgs } from './tests/browserGpu';
export default defineConfig({
  testDir:'./tests',testMatch:'feat013.spec.ts',workers:1,timeout:90000,
  outputDir:'test-results/feat013',reporter:'list',expect:{timeout:20000},
  use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:5193',viewport:{width:1440,height:900},launchOptions:{args:browserGpuArgs}},
  webServer:{command:'bun run dev --port 5193',url:'http://127.0.0.1:5193',reuseExistingServer:false,env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_VILLAGE_ID:'',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001'}},
});
