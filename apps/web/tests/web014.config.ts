import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: '.', testMatch: 'web014.spec.ts', outputDir: './artifacts/web014-runs', workers: 1,
  timeout: 45000, expect: {timeout:15000}, reporter:'list',
  use: {...devices['Desktop Chrome'], baseURL:'http://127.0.0.1:5186', viewport:{width:1280,height:900}, launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  projects:[{name:'contract-mock',grepInvert:/forced offline/},{name:'offline',grep:/forced offline/,use:{baseURL:'http://127.0.0.1:5187'}}],
  webServer:[5186,5187].map(port => ({cwd:resolve(import.meta.dirname,'..'),command:`bun run dev --port ${port}`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false,timeout:60000,env:{VITE_MOCK:port===5187?'1':'0',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:'',VITE_SOLANA_PROGRAM_ID:''}})),
});
