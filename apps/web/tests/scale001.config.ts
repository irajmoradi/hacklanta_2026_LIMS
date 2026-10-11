import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'scale001.spec.ts', workers: 1, timeout: 180000,
  expect:{timeout:30000},
  outputDir: 'artifacts/scale001/test-results',
  use: {baseURL:process.env.SCALE_URL ?? 'http://127.0.0.1:5197', viewport:{width:1440,height:1000},
    launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:process.env.SCALE_URL ? undefined : {command:'bun run dev --config tests/scale001.vite.config.ts --port 5197',cwd:'..',url:'http://127.0.0.1:5197',reuseExistingServer:false,
    env:{SCALE_LABEL:process.env.SCALE_LABEL ?? 'after',VITE_MOCK:'1',VILLAGE_ENV_FILE:'/dev/null',VILLAGE_API_URL:'http://127.0.0.1:1'}},
});
