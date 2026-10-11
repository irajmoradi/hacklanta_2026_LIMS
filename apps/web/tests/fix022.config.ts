import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'fix022.spec.ts', workers: 1, timeout: 120000,
  expect: {timeout:30000}, reporter:'list',
  use:{baseURL:'http://127.0.0.1:5198',viewport:{width:1440,height:1000},contextOptions:{reducedMotion:'reduce'},
    launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{command:'bun run dev --port 5198',url:'http://127.0.0.1:5198',reuseExistingServer:false,
    env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_VILLAGE_ID:'11111111-1111-4111-8111-111111111111'}}
});
