import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch:'barks.spec.ts', workers:1, timeout:90000,
  outputDir:'./artifacts/barks', reporter:'list',
  use:{baseURL:'http://127.0.0.1:5194',headless:true,viewport:{width:1100,height:850},
    launchOptions:{args:['--use-gl=angle','--use-angle=swiftshader']}},
  webServer:{command:'bun run dev --port 5194',url:'http://127.0.0.1:5194',reuseExistingServer:false,
    env:{VITE_MOCK:'1',VITE_AUTH0_DOMAIN:'',VITE_AUTH0_CLIENT_ID:''}},
});
