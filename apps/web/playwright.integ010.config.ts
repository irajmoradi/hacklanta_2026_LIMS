import { defineConfig } from '@playwright/test';
import base from './playwright.integ007.config';
export default defineConfig({
  ...base,
  testMatch: /(?:coins|web017|web019|web024|web030|web031|integ009).spec.ts/,
  timeout: 240000,
  outputDir: 'test-results/integ010',
  use: {...base.use, viewport:{width:1440,height:1000}, video:'retain-on-failure'},
});
