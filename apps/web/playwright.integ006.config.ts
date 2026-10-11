import { defineConfig } from '@playwright/test';
import arena from './playwright.web028.config';

// Retain traces and screenshots without video-encoder contention during GPU timing.
export default defineConfig({...arena, outputDir:'test-results/integ006',
  use:{...arena.use, video:'off', trace:'on'},
});
