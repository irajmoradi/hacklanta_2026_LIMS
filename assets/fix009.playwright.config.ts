import { defineConfig } from '../apps/web/node_modules/@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: 'fix009.spec.ts', workers: 1, timeout: 90000,
  outputDir: './previews/fix009-test-results', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5599', viewport: { width: 1280, height: 900 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: {
    command: 'node apps/web/node_modules/vite/bin/vite.js apps/web --host 127.0.0.1 --port 5599', cwd: '..',
    url: 'http://127.0.0.1:5599', timeout: 60000,
    env: { VITE_MOCK: '1', VITE_DEMO_AUTH: '1', VITE_DEMO_USER: '00000000-0000-4000-8000-000000000001', VITE_VILLAGE_ID: '' },
  },
});
