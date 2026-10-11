import { defineConfig } from '@playwright/test';
import config from './playwright.fix008.config';
export default defineConfig({...config, testMatch:'fix015.spec.ts', outputDir:'test-results/fix015',
  use:{...config.use,viewport:{width:1920,height:1080}}});
