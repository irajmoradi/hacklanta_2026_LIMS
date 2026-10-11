import { defineConfig } from '@playwright/test';
import base from '../playwright.feat016.config';

process.env.FEAT019_MOCK = '1';
export default defineConfig({
  ...base, testDir:'.', testMatch:'feat019.spec.ts', timeout:180000,
  outputDir:'../test-results/feat019-mock',
  use:{...base.use, baseURL:'http://127.0.0.1:5199'},
  webServer:{command:'bun run dev --port 5199', url:'http://127.0.0.1:5199', reuseExistingServer:false,
    env:{VITE_MOCK:'1', VITE_DEMO_AUTH:'1', VITE_VILLAGE_ID:''}},
});
