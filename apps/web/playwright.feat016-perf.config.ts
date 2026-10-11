import { defineConfig } from '@playwright/test';
import config from './playwright.feat016.config';
export default defineConfig({...config, testMatch: 'feat016-perf.spec.ts', outputDir: 'test-results/feat016-perf',
  use: {...config.use, video: 'off'},
});
