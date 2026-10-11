import {defineConfig} from '@playwright/test';
import base from './playwright.feat012.config';
import {browserGpuArgs} from './tests/browserGpu';
export default defineConfig({...base,
 use:{...base.use,baseURL:'http://127.0.0.1:5386',launchOptions:{args:browserGpuArgs}},
 webServer:{command:'bun run dev --port 5386',url:'http://127.0.0.1:5386',reuseExistingServer:false,
  env:{VITE_MOCK:'0',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:''}},
});
