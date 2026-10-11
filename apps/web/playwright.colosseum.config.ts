import { browserGpuArgs } from './tests/browserGpu';
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests',workers:1,timeout:60000,
  outputDir:'test-results/colosseum',reporter:'list',
  expect:{timeout:15000},
  use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900},trace:'retain-on-failure',launchOptions:{args:browserGpuArgs}},
  projects:[{name:'mock',testMatch:'colosseum.spec.ts',use:{baseURL:'http://127.0.0.1:5184'}},{name:'real',testMatch:'colosseum.spec.ts',use:{baseURL:'http://127.0.0.1:5185'}},{name:'regression',testMatch:'audits.spec.ts',use:{baseURL:'http://127.0.0.1:5184'}}],
  webServer:[
    {command:'bun run dev --port 5184',url:'http://127.0.0.1:5184',reuseExistingServer:false,env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_VILLAGE_ID:'',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001'}},
    {command:'bun run dev --port 5185',url:'http://127.0.0.1:5185',reuseExistingServer:false,env:{VITE_MOCK:'0',VITE_DEMO_AUTH:'1',VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000',VITE_DEMO_USER:'13370000-0000-4000-8000-000000000001'}},
  ],
});
