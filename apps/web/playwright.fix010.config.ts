import { defineConfig } from '@playwright/test';
import { browserGpuArgs } from './tests/browserGpu';
export default defineConfig({
 testDir:'./tests',testMatch:'fix010.spec.ts',outputDir:'test-results/fix010',workers:1,timeout:90000,
 expect:{timeout:20000},reporter:'list',
 use:{baseURL:'http://127.0.0.1:5510',viewport:{width:1280,height:800},hasTouch:true,video:'on',screenshot:'only-on-failure',launchOptions:{args:browserGpuArgs}},
 webServer:{command:'bun run dev --port 5510',url:'http://127.0.0.1:5510',reuseExistingServer:false,timeout:60000,
 env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:''}},
});
