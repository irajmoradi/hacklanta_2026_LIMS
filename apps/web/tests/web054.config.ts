import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'.', testMatch:'web054.spec.ts', workers:1, timeout:90000,
 outputDir:'./artifacts/web054/results',
 use:{baseURL:'http://127.0.0.1:5197', launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']},trace:'retain-on-failure'},
 webServer:{command:'bun run dev --port 5197',cwd:'..',url:'http://127.0.0.1:5197',reuseExistingServer:false,timeout:60000,
  env:{VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_AUTH0_DOMAIN:'',VITE_AUTH0_CLIENT_ID:'',VITE_VILLAGE_ID:'',VILLAGE_ENV_FILE:process.platform==='win32'?'NUL':'/dev/null',VILLAGE_API_URL:'http://127.0.0.1:1'}},
});
