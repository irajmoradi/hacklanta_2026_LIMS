import { defineConfig } from '@playwright/test';
import { browserGpuArgs } from './browserGpu';
export default defineConfig({
  testDir: '.', testMatch: 'lab.spec.ts', workers: 1, timeout: 120000,
  outputDir: 'screenshots/lab-results', reporter: 'list',
  use: {baseURL: 'http://127.0.0.1:5255', viewport: {width: 1440, height: 1000},
    launchOptions: {args: browserGpuArgs}, screenshot: 'only-on-failure', trace: 'retain-on-failure'},
  webServer: {command: 'bun run dev --port 5255', cwd: '.', url: 'http://127.0.0.1:5255', reuseExistingServer: false,
    env: {VITE_MOCK: '1', VITE_DEMO_AUTH: '1', VILLAGE_ENV_FILE: process.platform === 'win32' ? 'NUL' : '/dev/null', VILLAGE_API_URL: 'http://127.0.0.1:1'}, timeout: 60000},
});
