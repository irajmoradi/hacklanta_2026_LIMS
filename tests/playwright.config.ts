import { defineConfig } from '@playwright/test';
import { WEB } from './support/api';
export default defineConfig({
  testDir: './e2e', outputDir: './test-results/live', workers: 1, retries: 0, timeout: 90000,
  expect: { timeout: 15000 }, reporter: 'list',
  use: {
    baseURL: WEB, viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure', trace: 'off',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
});
