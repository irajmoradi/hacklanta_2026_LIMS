import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'feat027.spec.ts',workers:1,timeout:90000,expect:{timeout:20000},outputDir:'screenshots/feat027-results',reporter:'list',
 use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:5197',launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
 webServer:{command:'bun run dev --port 5197',url:'http://127.0.0.1:5197',timeout:60000,env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VILLAGE_API_URL:'http://127.0.0.1:1',VILLAGE_ENV_FILE:'/dev/null'}},
});
