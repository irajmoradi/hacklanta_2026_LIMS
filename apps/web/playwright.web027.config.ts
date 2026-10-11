import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir:'./tests', testMatch: /web0(?:27|15).spec.ts/, outputDir:'test-results/web027-runs', workers:1, timeout:120000,
 use:{baseURL:'http://127.0.0.1:5187', permissions:['camera'], launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
 projects:[{name:'onboarding',testMatch:'web027-onboarding.spec.ts',use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:5188'}},{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',testMatch:'web027.spec.ts',use:{...devices['Pixel 7']}}],
 webServer:[{command:'bun run dev --port 5188',url:'http://127.0.0.1:5188',reuseExistingServer:false,env:{VITE_MOCK:'0',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:''}}, {command:'bun run dev --port 5187',url:'http://127.0.0.1:5187',reuseExistingServer:false,env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000'}}]
});
