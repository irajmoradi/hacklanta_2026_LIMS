import { defineConfig } from '@playwright/test';
import { browserGpuArgs } from './browserGpu';
export default defineConfig({ testDir: '.', testMatch: 'web056.spec.ts', workers: 1, timeout: 120000, reporter: 'list', outputDir: '../test-results/web056', use: {baseURL:'http://127.0.0.1:5196', viewport:{width:1440,height:1000}, launchOptions:{args:browserGpuArgs}}, webServer: {command:'bun run dev --port 5196',url:'http://127.0.0.1:5196',reuseExistingServer:false,env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1'},timeout:60000} });
