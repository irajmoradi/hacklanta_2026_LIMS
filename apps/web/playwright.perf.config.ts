import {defineConfig} from '@playwright/test';
const port=Number(process.env.PERF_PREVIEW_PORT || 5187);
const url=`http://127.0.0.1:${port}`;
export default defineConfig({
  testDir:'./tests/perf',testMatch:'*.spec.ts',workers:1,timeout:60000,
  outputDir:'test-results/perf002',reporter:'list',
  use:{baseURL:url,viewport:{width:1440,height:1000},trace:'retain-on-failure'},
  webServer:{command:`bun run preview --port ${port} --strictPort`,url,reuseExistingServer:false,env:{VILLAGE_API_URL:'http://127.0.0.1:9'}},
});
