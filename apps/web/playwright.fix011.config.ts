import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'fix011.spec.ts', workers: 1, timeout: 60000,
  outputDir: 'test-results/fix011', reporter: 'list',
  use: {baseURL:'http://127.0.0.1:5181', viewport:{width:1280,height:720}, launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer: {command:'bun run preview --port 5181', url:'http://127.0.0.1:5181', reuseExistingServer:false,
    env:{VILLAGE_API_URL:'http://127.0.0.1:18011'}, timeout:60000},
});
