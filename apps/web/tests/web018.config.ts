import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: '.', testMatch: /web01[68].spec.ts/, outputDir: '../test-results/web018-runs', workers: 1,
  timeout: 60000, expect: {timeout:15000}, reporter:'list',
  use: {screenshot:'only-on-failure', trace:'retain-on-failure', ...devices['Desktop Chrome'], baseURL:'http://127.0.0.1:5396', viewport:{width:1366,height:768}, launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{cwd:resolve(import.meta.dirname,'..'),command:'bun run dev --port 5396',url:'http://127.0.0.1:5396',reuseExistingServer:false,timeout:60000,env:{VITE_MOCK:'0',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:''}},
});
