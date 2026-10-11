import { defineConfig } from '@playwright/test';
import base from './playwright.web021.config';
export default defineConfig({...base,outputDir:'test-results/web021-real-run',testMatch:'web021-real.spec.ts',projects:[{name:'real'}],
 use:{...base.use,baseURL:'http://127.0.0.1:5322',viewport:{width:1440,height:900}},
 webServer:{command:'bun run dev --port 5322',url:'http://127.0.0.1:5322',reuseExistingServer:false,env:{VITE_MOCK:'0',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'13370000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000'}},
});
