import { defineConfig } from '@playwright/test';
import config from './playwright.config';
export default defineConfig({ ...config, projects: [{ name: 'mock', testMatch: 'fix008-surfaces.spec.ts' }],
  webServer: Array.isArray(config.webServer) ? config.webServer.slice(0, 1) : config.webServer });
