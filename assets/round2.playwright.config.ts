import { defineConfig } from '../apps/web/node_modules/@playwright/test';
export default defineConfig({
  testDir:'./tests', testMatch:'round2.spec.ts', workers:1, timeout:90000,
  outputDir:'./previews/round2-test-results', reporter:'list',
  use:{baseURL:'http://127.0.0.1:51938',viewport:{width:1280,height:1000},launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{command:'bun run --cwd apps/web dev --port 51938',cwd:'..',url:'http://127.0.0.1:51938',timeout:120000,
    env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:''}},
});
