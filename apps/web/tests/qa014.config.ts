import { defineConfig } from '@playwright/test';
import { browserGpuArgs } from './browserGpu';

// Explicitly authorized read-only production audit; no local server or credentials.
export default defineConfig({
  testDir: '.', testMatch: 'qa014.spec.ts', workers: 1, retries: 0,
  timeout: 1500000, reporter: 'list', outputDir: './artifacts/QA-014',
  use: { baseURL: 'https://thefriendshipvillage.vodka', serviceWorkers: 'block',
    launchOptions: { args: browserGpuArgs }, actionTimeout: 7000 },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
});
