import {defineConfig} from '@playwright/test';
import base from './playwright.integ015.config';
const ports:Record<string,string>={5174:'15474',5175:'15475',5177:'15477',5187:'15487',5197:'15497'};
const remap=(text:string)=>text.replace(/5174|5175|5177|5187|5197/g,port=>ports[port]);

// The CLI runs on the Linux runner; a loopback SSH tunnel connects its browser
// protocol to headed Chromium on the Windows RTX 5090 host. No live API is exposed.
export default defineConfig({
  ...base, outputDir:'test-results/integ015-hardware',
  reporter:[['list'],['json',{outputFile:'artifacts/integ015/e2e-hardware.json'}]],
  use:{...base.use,baseURL:remap(base.use!.baseURL!)},
  projects:base.projects!.map(project=>({...project,use:{...project.use,...(project.use?.baseURL?{baseURL:remap(project.use.baseURL)}:{})}})),
  webServer:(base.webServer as Array<{command:string;url:string}>).map(server=>({...server,command:remap(server.command),url:remap(server.url)})),
});
