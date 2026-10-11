import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: '.', testMatch: 'web012.spec.ts', outputDir: './artifacts/web012-runs', workers: 1,
  timeout: 45000, expect: { timeout: 15000 }, reporter: 'list',
  use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 }, launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
  projects: [ { name: 'flag-off', grepInvert: /actual wallet hooks/, use: { baseURL: 'http://127.0.0.1:5182' } }, { name: 'flag-on', grepInvert: /actual wallet hooks/, use: { baseURL: 'http://127.0.0.1:5183' } }, { name: 'wallet-runtime', grep: /actual wallet hooks/, use: { baseURL: 'http://127.0.0.1:5184' } } ],
  webServer: [5182, 5183, 5184].map(port => ({
    cwd: resolve(import.meta.dirname, '..'),
    command: `bun run dev --config tests/web012.vite.config.ts --port ${port}`,
    url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 60000,
    env: { WEB012_VARIANT: String(port), VITE_MOCK: '0', VITE_DEMO_AUTH: '1', VITE_DEMO_USER: '00000000-0000-4000-8000-000000000001', VITE_VILLAGE_ID: '', VITE_SOLANA_PROGRAM_ID: port !== 5182 ? '11111111111111111111111111111111' : '' },
  })),
});
