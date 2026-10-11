import {defineConfig, devices} from '@playwright/test';
import {fileURLToPath} from 'node:url';
export default defineConfig({testDir:'.',testMatch:'feat029.spec.ts',workers:1,timeout:90000,
 expect:{timeout:20000},outputDir:'screenshots/feat029-results',reporter:'list',
 projects:[{name:'desktop',use:{viewport:{width:1440,height:900}}},{name:'mobile',use:{viewport:{width:390,height:844}}}],
 use:{...devices['Desktop Chrome'],screenshot:'only-on-failure',trace:'retain-on-failure',baseURL:'http://127.0.0.1:5199',launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
 webServer:{cwd:fileURLToPath(new URL('../',import.meta.url)),command:'bunx vite --config tests/feat029.vite.ts --host 127.0.0.1 --port 5199',url:'http://127.0.0.1:5199',timeout:60000,
 env:{VITE_MOCK:'0',VITE_DEMO_AUTH:'1',VITE_AUTH0_ENABLED:'1',VITE_AUTH0_DOMAIN:'synthetic.test',VITE_AUTH0_CLIENT_ID:'synthetic-client',VITE_AUTH0_AUDIENCE:'synthetic-api',VILLAGE_ENV_FILE:'/dev/null',VILLAGE_API_URL:'http://127.0.0.1:1'}}});
