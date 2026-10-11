import { defineConfig } from '@playwright/test';
import base from './playwright.web030.config';
export default defineConfig({...base, testMatch: /web03[01].spec.ts/, outputDir:'test-results/web031', use:{...base.use,baseURL:'http://127.0.0.1:5331'}, webServer:{...base.webServer as object,command:'bun run dev --port 5331',url:'http://127.0.0.1:5331'}});
