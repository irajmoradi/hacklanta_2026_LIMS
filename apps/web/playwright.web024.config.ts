import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests', testMatch:'web024.spec.ts', workers:1, timeout:240000,
  expect:{timeout:15000}, reporter:'list', outputDir:'test-results/web024-runs',
  use:{baseURL:'http://127.0.0.1:5194',viewport:{width:1440,height:1000},launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']},screenshot:'only-on-failure'},
  webServer:{command:'bun run dev --port 5194',url:'http://127.0.0.1:5194',reuseExistingServer:false,env:{VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000'}},
});
