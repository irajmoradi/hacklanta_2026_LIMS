import {defineConfig} from '@playwright/test';
import base from '../playwright.web033.config';
import {fileURLToPath} from 'node:url';
export default defineConfig({...base, testDir: '.', testMatch: 'web050.spec.ts', timeout: 240000,
  projects: [{name:'before'}, {name:'after', dependencies:['before']}],
  outputDir: '../test-results/web050',
  use: {...base.use, baseURL: 'http://127.0.0.1:5350'},
  webServer: {...base.webServer as object, cwd: fileURLToPath(new URL('..',import.meta.url)), command: 'bun run dev --port 5350', url: 'http://127.0.0.1:5350'}});


