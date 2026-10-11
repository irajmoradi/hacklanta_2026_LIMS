import { defineConfig } from '../apps/web/node_modules/@playwright/test/index.mjs';
import source from '../apps/web/playwright.config';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));

// Keep app tests unchanged and all screenshots/output inside the allowed tests tree.
export default defineConfig({
  ...source,
  projects: [...source.projects!, {
    name: 'scene', testDir: resolve(here, 'wave3'), testMatch: 'scene.spec.ts',
    use: { baseURL: 'http://127.0.0.1:5175', viewport: { width: 1920, height: 1080 } },
  }, {
    name: 'wave3', testDir: resolve(here, 'wave3'), testMatch: 'group-photo.spec.ts',
  }],
  testDir: resolve(here, '../apps/web/tests'),
  outputDir: resolve(here, 'test-results/mock'),
  webServer: (source.webServer as any[]).map(server => ({
    ...server, cwd: resolve(here, '../apps/web'),
  })),
});
