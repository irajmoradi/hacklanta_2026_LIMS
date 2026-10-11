import { defineConfig } from '@playwright/test';
import { browserGpuArgs } from './browserGpu';

export default defineConfig({
  testDir: '.', testMatch: /(?:web058(?:-layout)?|qa014)\.spec\.ts/, workers: 1, retries: 0,
  timeout: 1500000, reporter: 'list', outputDir: './artifacts/WEB-058',
  use: {baseURL:'http://127.0.0.1:5188', serviceWorkers:'block', actionTimeout:15000,
    launchOptions:{args:browserGpuArgs}, screenshot:'only-on-failure'},
  projects: [
    {name:'desktop', use:{viewport:{width:1440,height:900}}},
    {name:'mobile', use:{viewport:{width:390,height:844}}},
  ],
  webServer: {command:'bun run dev --port 5188', url:'http://127.0.0.1:5188', reuseExistingServer:false,
    env:{VITE_MOCK:'1', VITE_DEMO_AUTH:'1', VITE_DEMO_DEBUG:'0', VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001', VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000'}, timeout:60000},
});
