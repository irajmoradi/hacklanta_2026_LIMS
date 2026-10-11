import { defineConfig } from '../../apps/web/node_modules/@playwright/test/index.mjs';
export default defineConfig({
  testDir: '.', testMatch: 'stage.spec.mjs', workers: 1,
  timeout: 180000, reporter: 'list',
  outputDir: '../../docs/infra/screenshots/deploy-stage-results',
  use: {
    baseURL: 'https://stage.207-246-81-187.sslip.io',
    viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
});
