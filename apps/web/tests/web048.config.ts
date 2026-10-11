import {defineConfig,devices} from '@playwright/test';
import {fileURLToPath} from 'node:url';
export default defineConfig({
  testDir:'.',testMatch:'web048.spec.ts',workers:1,timeout:180000,expect:{timeout:15000},
  outputDir:'./artifacts/web048/results',reporter:[['list'],['json',{outputFile:'artifacts/web048/playwright.json'}]],
  use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:5348',viewport:{width:1280,height:800},screenshot:'only-on-failure',launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}},
  webServer:{cwd:fileURLToPath(new URL('..',import.meta.url)),command:'bun run typecheck && bun run dev --port 5348',url:'http://127.0.0.1:5348',reuseExistingServer:false,env:{VILLAGE_ENV_FILE:process.platform === 'win32' ? 'NUL' : '/dev/null',VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001'}},
});
