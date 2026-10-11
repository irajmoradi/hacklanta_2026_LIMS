import {defineConfig} from '@playwright/test';
import config from './playwright.feat014.config';
import {browserGpuArgs} from './tests/browserGpu';
export default defineConfig({...config,testMatch:'web028.spec.ts',grep:/record transition/,outputDir:'test-results/feat014-perf',use:{...config.use,launchOptions:{args:browserGpuArgs}}});
