import { browserGpuArgs } from './tests/browserGpu';
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:['web028.spec.ts','colosseum.spec.ts','audits.spec.ts'],projects:[{name:'mock'}],workers:1,timeout:90000,
  outputDir:'test-results/web028',reporter:'list',expect:{timeout:15000},
  use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900},baseURL:'http://127.0.0.1:5188',trace:'on',video:'on',launchOptions:{args:browserGpuArgs}},
  webServer:{command:'bun run dev --port 5188',url:'http://127.0.0.1:5188',reuseExistingServer:false,env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_VILLAGE_ID:'',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001'}},
});
