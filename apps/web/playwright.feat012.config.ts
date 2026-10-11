import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:'feat012.spec.ts',workers:1,timeout:150000,
  outputDir:'test-results/feat012',reporter:'list',
  use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:5186',viewport:{width:1440,height:1000},
    launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{command:'bun run dev --port 5186',url:'http://127.0.0.1:5186',reuseExistingServer:false,
    env:{VITE_MOCK:'0',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:''}},
});
