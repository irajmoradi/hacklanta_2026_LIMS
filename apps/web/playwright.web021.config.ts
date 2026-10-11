import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
 ...base, testMatch:/(?:web021|equipment|village).spec.ts/, projects:[{name:'mock'}],
 use:{...base.use,baseURL:'http://127.0.0.1:5321'},
 webServer:{command:'bun run dev --port 5321',url:'http://127.0.0.1:5321',reuseExistingServer:false,env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_VILLAGE_ID:''}},
});
