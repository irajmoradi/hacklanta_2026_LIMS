import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,
 projects: [{name:'web032',testMatch:'web032.spec.ts'}],
 use: {...base.use, baseURL:'http://127.0.0.1:5232'},
 webServer: {command:'bun run dev --port 5232',url:'http://127.0.0.1:5232',reuseExistingServer:false,
 env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:''},timeout:60000},
});
