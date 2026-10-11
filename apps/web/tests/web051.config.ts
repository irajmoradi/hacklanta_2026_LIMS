import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: '.', testMatch: 'web051.spec.ts', workers: 1, timeout: 180000, expect:{timeout:15000}, reporter: 'list',
 outputDir: '../test-results/web051',
 use: {baseURL:'http://127.0.0.1:5189', launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}, trace:'retain-on-failure'},
 webServer: {command:'bun run dev --port 5189', cwd:fileURLToPath(new URL('..',import.meta.url)), url:'http://127.0.0.1:5189', reuseExistingServer:false,
 env:{VITE_MOCK:'1', VITE_DEMO_AUTH:'1', VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001', VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000', VILLAGE_ENV_FILE:'/dev/null', VILLAGE_API_URL:'http://127.0.0.1:1'}}
});
