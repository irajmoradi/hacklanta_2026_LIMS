import {defineConfig} from '@playwright/test';
import base from './playwright.config';
import {browserGpuArgs} from './tests/browserGpu';
export default defineConfig({
 ...base, testMatch: /(?:coins|web030).spec.ts/, projects:[{name:'mock'}],
 timeout:120000, outputDir:'test-results/integ007',
 use:{...base.use,baseURL:'http://127.0.0.1:5377',launchOptions:{args:browserGpuArgs}},
 webServer:{command:'bun run dev --port 5377',url:'http://127.0.0.1:5377',reuseExistingServer:false,
  env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001'}},
});
