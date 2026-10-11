import {defineConfig} from '@playwright/test';
import base from '../playwright.web033.config';
import {fileURLToPath} from 'node:url';
export default defineConfig({...base, testDir: '.', testMatch:'web049.spec.ts', timeout:240000,
  outputDir:'../test-results/web049',
  use:{...base.use, actionTimeout:30000, trace:'retain-on-failure', baseURL:'http://127.0.0.1:5349'},
  webServer:{...base.webServer as object, cwd:fileURLToPath(new URL('..', import.meta.url)), command:'bun run dev --port 5349', url:'http://127.0.0.1:5349'}});
