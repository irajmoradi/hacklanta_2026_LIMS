import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir:'./tests', testMatch:'feat010.spec.ts', workers:1, timeout:45000,
  outputDir:'test-results/feat010', reporter:'list',
  use:{...devices['Desktop Chrome'], baseURL:'http://127.0.0.1:5184', viewport:{width:1280,height:900},
    launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{command:'bun run dev --port 5184', url:'http://127.0.0.1:5184', reuseExistingServer:false,
    env:{VITE_MOCK:'0',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:''}},
});
