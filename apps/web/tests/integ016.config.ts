import {defineConfig} from '@playwright/test';
import base from './web044.config';
// Run the three integration suites under the same explicitly offline server.
process.env.VILLAGE_FEAT019_MOCK = '1';
export default defineConfig({...base,
  testMatch:['web044.spec.ts','web045.spec.ts','feat019.spec.ts'],
  outputDir:'../artifacts/integ016/results'});
