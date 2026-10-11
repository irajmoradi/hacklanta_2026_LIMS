import { defineConfig } from '../apps/web/node_modules/@playwright/test/index.mjs';
export default defineConfig({
  testDir: './wave4', outputDir: './test-results/wave4', workers: 1, retries: 0,
  timeout: 60000, expect: {timeout: 15000}, reporter: 'list',
  use: {baseURL: 'http://127.0.0.1:4173', viewport: {width: 1440, height: 900},
    trace: 'off', screenshot: 'only-on-failure',
    launchOptions: {args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']}},
  projects: [{name: 'live', testMatch: 'live.spec.ts'}],
});
