import base from './playwright.feat012.config';
import {defineConfig} from '@playwright/test';
export default defineConfig({...base,testMatch:['vfx001.spec.ts','vfx001-transitions.spec.ts'],outputDir:'test-results/vfx001', use:{...base.use,...(process.env.VFX_GPU==='1'?{launchOptions:{args:['--use-angle=d3d11','--ignore-gpu-blocklist']}}:{}),video:{mode:process.env.VFX_GPU==='1'?'off':'on',size:{width:1440,height:1000}},baseURL:'http://127.0.0.1:5291'},webServer:{...(base.webServer as object),command:'bun run dev --port 5291',url:'http://127.0.0.1:5291'}});
