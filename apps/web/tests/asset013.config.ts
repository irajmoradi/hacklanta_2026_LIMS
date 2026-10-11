import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: 'asset013.spec.ts', workers: 1, timeout: 90000,
  expect: {timeout: 20000}, reporter: 'list',
  use: {baseURL:'http://127.0.0.1:5193', launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}, screenshot:'only-on-failure'},
  webServer: {command:'bun run dev --port 5193',url:'http://127.0.0.1:5193',reuseExistingServer:false,timeout:60000,
    env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000'}},
});
