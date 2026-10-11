import {defineConfig} from '@playwright/test';
import base from '../playwright.web033.config';
import {fileURLToPath} from 'node:url';
export default defineConfig({...base,testDir:'.',testMatch:'web050-perf.spec.ts',timeout:360000,
  outputDir:'../test-results/web050-perf',
  use:{...base.use,baseURL:'http://127.0.0.1:5350'},
  webServer:{...base.webServer as object,cwd:fileURLToPath(new URL('..',import.meta.url)),command:'bun run dev --port 5350',url:'http://127.0.0.1:5350'}});
