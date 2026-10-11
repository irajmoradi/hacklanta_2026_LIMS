import { defineConfig } from '@playwright/test';
import base from './playwright.feat009-real.config';
export default defineConfig({...base, testMatch:'integ005-persistence.spec.ts', outputDir:'test-results/integ005-house'});
