import {defineConfig} from '@playwright/test';
import base from '../playwright.web033.config';
import {fileURLToPath} from 'node:url';
export default defineConfig({...base, testDir: '.', testMatch: 'web043.spec.ts', timeout: 180000,
  outputDir: '../test-results/web043',
  use: {...base.use, baseURL: 'http://127.0.0.1:5343'},
  webServer: {...base.webServer as object, cwd: fileURLToPath(new URL('..',import.meta.url)), command: 'bun run dev --port 5343', url: 'http://127.0.0.1:5343'}});
