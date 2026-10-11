import { defineConfig } from '@playwright/test';
import base from './lab.config';
export default defineConfig({...base, testMatch:'lab057.spec.ts', timeout:240000,
  outputDir:'screenshots/WEB-057/results'});
