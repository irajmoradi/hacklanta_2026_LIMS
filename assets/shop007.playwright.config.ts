import { defineConfig } from '../apps/web/node_modules/@playwright/test';

export default defineConfig({
  testDir: './tests', testMatch: 'shop007.spec.ts', workers: 1, timeout: 60000,
  outputDir: './previews/shop007-test-results', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5597', viewport: { width: 1280, height: 900 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  webServer: {
    command: 'bun run --cwd apps/web dev --port 5597', cwd: '..', url: 'http://127.0.0.1:5597', timeout: 60000,
    env: { VITE_MOCK: '1', VITE_DEMO_AUTH: '1', VITE_DEMO_USER: '00000000-0000-4000-8000-000000000001', VITE_VILLAGE_ID: '' },
  },
});
