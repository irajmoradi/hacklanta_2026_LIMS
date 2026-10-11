import {defineConfig} from '@playwright/test';
import base from './playwright.web030.config';
export default defineConfig({
  ...base, testMatch: /(?:web037|web030).spec.ts/, outputDir:'test-results/web037',
  use:{...base.use,baseURL:'http://127.0.0.1:5337'},
  webServer:{...base.webServer as object,command:'bun run dev --port 5337',url:'http://127.0.0.1:5337'},
});
