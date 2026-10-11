import {defineConfig, devices} from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch:'feat002.spec.ts', outputDir:'../test-results/feat002', workers:1,
  timeout:90000, expect:{timeout:20000}, reporter:'list',
  use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:5192',viewport:{width:1280,height:900},
    launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{command:'bun run dev --port 5192',url:'http://127.0.0.1:5192',timeout:60000,
    env:{VITE_MOCK:'0',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:''}},
});
