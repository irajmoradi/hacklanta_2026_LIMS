import { defineConfig } from '@playwright/test';
import base from './web058.config';
export default defineConfig({...base, testMatch:'qa015-mock.spec.ts', timeout:240000, outputDir:'./artifacts/WEB-059'});
