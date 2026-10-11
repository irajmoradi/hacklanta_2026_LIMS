// Uses the explicitly started scratch preview API and Vite, like tests/perf/town.mjs.
import {defineConfig} from '@playwright/test';
import base from './playwright.web029.config';
export default defineConfig({...base,webServer:undefined});
