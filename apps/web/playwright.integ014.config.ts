import { defineConfig } from '@playwright/test';
import base from './playwright.feat016.config';

export default defineConfig({
  ...base,
  testMatch: /(?:integ013|integ014|feat016|feat018|web034|web035|fix013).spec.ts/,
  outputDir: 'test-results/integ014',
  use: {...base.use, video: 'off', baseURL: 'http://127.0.0.1:15314'},
  webServer: {...base.webServer as object, command: 'bun run dev --port 15314', url: 'http://127.0.0.1:15314'},
});
