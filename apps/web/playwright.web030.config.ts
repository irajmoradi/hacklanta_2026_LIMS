import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
 ...base, timeout:90000, outputDir:'test-results/web030', testMatch: /web030.spec.ts/, projects: [{name:'mock'}],
 use: {...base.use, baseURL:'http://127.0.0.1:5330'},
 webServer: {command:'bun run dev --port 5330',url:'http://127.0.0.1:5330',reuseExistingServer:false,env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001'}},
});
