import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: 'web017-real.spec.ts', workers: 1, timeout: 180000,
  outputDir: 'test-results/web017-real', reporter: 'list',
  use: {...devices['Desktop Chrome'], baseURL:'http://127.0.0.1:5296',
    viewport:{width:1440,height:1000}, launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{command:'bun run dev --port 5296', url:'http://127.0.0.1:5296', reuseExistingServer:false,
    env:{VITE_MOCK:'0',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'13370000-0000-4000-8000-000000000001',
      VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000',VILLAGE_API_URL:'http://127.0.0.1:8027'}},
});
