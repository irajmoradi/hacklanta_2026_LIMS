import {defineConfig} from '@playwright/test';
import base from './playwright.web030.config';
import {browserGpuArgs} from './tests/browserGpu';

export default defineConfig({
  ...base,
  timeout: 120000,
  testMatch: /(?:integ013|web030|web035|web036|web037|fix013|fix014|feat014|colosseum|audits|features|polish|web015|web021|feat013|village).spec.ts/,
  outputDir: 'test-results/integ013',
  use: {...base.use, actionTimeout:20000, baseURL: 'http://127.0.0.1:15313', launchOptions: {args:browserGpuArgs}},
  webServer: {...base.webServer as object, command: 'bun run dev --port 15313', url: 'http://127.0.0.1:15313'},
});
