import { defineConfig } from '@playwright/test';
import { browserGpuArgs } from './browserGpu';
export default defineConfig({
  testDir: '.', testMatch: 'feat025.spec.ts', workers:1, timeout:90000,
  expect:{timeout:15000}, reporter:'list', outputDir:'../test-results/feat025',
  use:{baseURL:'http://127.0.0.1:5225',viewport:{width:1440,height:1000},launchOptions:{args:browserGpuArgs}},
  webServer:{command:'bun run dev --port 5225',url:'http://127.0.0.1:5225',reuseExistingServer:false,
    env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1'}},
});
