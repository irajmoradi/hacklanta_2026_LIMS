import { defineConfig } from '@playwright/test';
if (!process.env.VILLAGE_API_URL || process.env.VILLAGE_API_URL.includes(':8010')) throw new Error('Use remote_run.sh --with-api');
export default defineConfig({
  testDir: '.', testMatch: 'movement.spec.ts', workers: 1, timeout: 90000,
  outputDir: './artifacts/movement', reporter: 'list',
  use: {baseURL:'http://127.0.0.1:5192', headless:true, viewport:{width:1000,height:800}, video:'on', trace:'retain-on-failure',
    launchOptions:{args:['--use-gl=angle','--use-angle=swiftshader','--disable-web-security']}},
  webServer: {command:'bun run dev --port 5192', url:'http://127.0.0.1:5192', reuseExistingServer:false,
    env:{VITE_MOCK:'0', VITE_DEMO_AUTH:'1', VITE_AUTH0_DOMAIN:'', VITE_AUTH0_CLIENT_ID:'', VITE_DEMO_USER:'13370000-0000-4000-8000-000000000001'}},
});
