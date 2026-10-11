import base from './playwright.fix008.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({...base, testMatch:'fix012.spec.ts', outputDir:'test-results/fix012'});
