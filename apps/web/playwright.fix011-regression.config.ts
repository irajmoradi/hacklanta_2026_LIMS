import base from './playwright.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({...base, testDir:'./tests', outputDir:'./test-results/fix011-regressions',
  projects:[{name:'connection',testMatch:'connection.spec.ts',use:{baseURL:'http://127.0.0.1:5182'}}],
  webServer:{command:'bun run dev --port 5182',url:'http://127.0.0.1:5182',reuseExistingServer:false,
    env:{VITE_MOCK:'0',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:''}},
});
