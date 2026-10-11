import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: '.', testMatch: /web026.spec.ts/, outputDir: '../test-results/web026-runs', workers: 1,
  timeout: 60000, expect: {timeout:15000}, reporter:'list',
  use: {...devices['Desktop Chrome'], baseURL:'http://127.0.0.1:5426', viewport:{width:1366,height:900}, trace:'retain-on-failure', launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  projects:[{name:"settings-ui",testMatch:/web026.spec.ts/},{name:"voice-regression",testMatch:/settings.spec.ts/,use:{baseURL:"http://127.0.0.1:5427"}}],
  webServer:[{cwd:resolve(import.meta.dirname,'..'),command:'bun run dev --port 5426',url:'http://127.0.0.1:5426',reuseExistingServer:false,timeout:60000,env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000'}},
  {cwd:resolve(import.meta.dirname,'..'),command:'bun run dev --port 5427',url:'http://127.0.0.1:5427',reuseExistingServer:false,timeout:60000,env:{VITE_MOCK:'0',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:''}}],
});
