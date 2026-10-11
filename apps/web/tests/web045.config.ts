import {defineConfig, devices} from '@playwright/test';
import {fileURLToPath} from 'node:url';
export default defineConfig({
  testDir:'.', testMatch:'web045.spec.ts', workers:1, timeout:90000, expect:{timeout:20000},
  outputDir:'../artifacts/web045/results', reporter:'list',
  use:{...devices['Desktop Chrome'], baseURL:'http://127.0.0.1:5345', launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{cwd:fileURLToPath(new URL('..',import.meta.url)), command:'bun run dev --port 5345', url:'http://127.0.0.1:5345', reuseExistingServer:false,
    env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VILLAGE_ENV_FILE:'/dev/null',VILLAGE_API_URL:'http://127.0.0.1:1'}}
});
