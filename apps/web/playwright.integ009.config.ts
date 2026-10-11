import { defineConfig } from '@playwright/test';
import base from './playwright.integ007.config';
export default defineConfig({
  ...base,
  testMatch: /(?:coins|web030|web031|integ009).spec.ts/,
  outputDir: 'test-results/integ009',
});
