import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'web046.spec.ts', workers:1, timeout:90000,
  expect:{timeout:15000}, reporter:'list', outputDir:'../test-results/web046',
  use:{baseURL:'http://127.0.0.1:5196',...devices['Desktop Chrome'],launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']},trace:'retain-on-failure'},
  projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:390,height:844}}}],
  webServer:{command:'bun run dev --port 5196',url:'http://127.0.0.1:5196',reuseExistingServer:false,env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000'}},
});
