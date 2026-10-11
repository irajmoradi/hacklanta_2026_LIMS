import { defineConfig } from '@playwright/test';
import base from './playwright.web021.config';
export default defineConfig({...base,outputDir:'test-results/web021-profile-run',testMatch:'web016.spec.ts',projects:[{name:'profile'}],
 use:{...base.use,baseURL:'http://127.0.0.1:5323'},
 webServer:{command:'bun run dev --port 5323',url:'http://127.0.0.1:5323',reuseExistingServer:false,env:{VITE_MOCK:'0',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:''}},
});
