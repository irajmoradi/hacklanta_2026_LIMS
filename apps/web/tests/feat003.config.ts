import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: '.', testMatch: 'feat003.spec.ts', outputDir:'../test-results/feat003-runs', workers:1,
  timeout:60000, expect:{timeout:15000}, reporter:'list',
  use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:5198',trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{cwd:resolve(import.meta.dirname,'..'),command:'bun run dev --port 5198',url:'http://127.0.0.1:5198',reuseExistingServer:false,timeout:60000,env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:''}},
});
