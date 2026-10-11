import { defineConfig } from '@playwright/test';
import base from './playwright.config';
const remap = (url: string) => url.replace('5174','5294').replace('5175','5295').replace('5177','5297');
export default defineConfig({...base,
  use:{...base.use,baseURL:remap(base.use!.baseURL!)},
  projects:base.projects!.map(p=>({...p,use:{...p.use,...(p.use?.baseURL?{baseURL:remap(p.use.baseURL)}:{})}})),
  webServer:(base.webServer as any[]).map(s=>({...s,url:remap(s.url),command:remap(s.command)})),
});
