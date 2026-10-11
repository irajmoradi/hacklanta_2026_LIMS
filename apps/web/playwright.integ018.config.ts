import {defineConfig} from '@playwright/test';
import base from './playwright.integ015.config';

const remap = (text: string) => text.replace(/5174|5175|5177|5187|5197/g, port => ({5174:'16474',5175:'16475',5177:'16477',5187:'16487',5197:'16497'}[Number(port)]!));
export default defineConfig({
  ...base,
  outputDir: 'test-results/integ018',
  reporter: [['list'], ['json', {outputFile:'artifacts/integ018/browser.json'}]],
  use: {...base.use, baseURL:remap(base.use!.baseURL!)},
  projects: [...base.projects!.map(project => ({
    ...project,
    ...(project.name === 'production' ? {metadata:{buildDir:'artifacts/integ018/final-build'}} : {}),
    ...(project.name === 'integration' ? {testMatch: /(?:feat013|web031|web039|web040|web045|web048|web049|web046|feat020).spec.ts/} : {}),
    use: {...project.use, ...(project.use?.baseURL ? {baseURL:remap(project.use.baseURL)} : {})},
  })), {name:'visual',testDir:'./tests/perf',testMatch:'renderer.spec.mjs',use:{viewport:{width:1440,height:1000}}},
    {name:'diagnostic',testDir:'./tests/perf',testMatch:'shop-profile.spec.mjs',use:{viewport:{width:1440,height:1000}}}],
  webServer: (base.webServer as Array<{command:string;url:string}>).map(server => ({...server, command:remap(server.command).replace('bun run preview','bun run preview --outDir artifacts/integ018/final-build'), url:remap(server.url)})),
});
