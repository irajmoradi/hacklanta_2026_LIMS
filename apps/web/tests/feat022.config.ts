import { defineConfig } from '@playwright/test';
if (!process.env.VILLAGE_API_URL) throw new Error('Run with remote_run.sh --with-api');
export default defineConfig({
  testDir: '.', testMatch: 'feat022.spec.ts', workers: 1, timeout: 90000,
  expect: {timeout:15000},
  outputDir: 'test-results/feat022',
  use: {baseURL:'http://127.0.0.1:5188',viewport:{width:1440,height:1000},video:'on',trace:'retain-on-failure',launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{command:'bun run dev --port 5188',url:'http://127.0.0.1:5188',reuseExistingServer:false,
    env:{VITE_MOCK:'0',VITE_DEMO_AUTH:'1',VITE_AUTH0_DOMAIN:'',VITE_AUTH0_CLIENT_ID:'',VILLAGE_ENV_FILE:'/dev/null',VILLAGE_API_URL:process.env.VILLAGE_API_URL}},
});
