import { defineConfig } from '@playwright/test';
import base from './playwright.config';
const remap = (url: string) => url.replace('5174','5394').replace('5175','5395').replace('5177','5397');
export default defineConfig({...base,
  use:{...base.use,baseURL:remap(base.use!.baseURL!)},
  projects:base.projects!.map(p=>({...p,
    ...(p.name === 'connection' ? {testMatch:/(?:connection|settings|heads|web015-live|web016).spec.ts/} : {}),
    use:{...p.use,...(p.use?.baseURL?{baseURL:remap(p.use.baseURL)}:{})}})),
  webServer:(base.webServer as any[]).map(s=>({...s,url:remap(s.url),command:remap(s.command)})),
});
