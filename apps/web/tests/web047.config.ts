import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { browserGpuArgs } from './browserGpu';
const before = existsSync(new URL('./web047-before.json', import.meta.url));
const mock = {VITE_MOCK:'1',VITE_DEMO_AUTH:'1',VITE_VILLAGE_ID:'',VITE_DEMO_USER:'00000000-0000-4000-8000-000000000001'};
const sizes = [{name:'desktop',viewport:{width:1440,height:900}}, {name:'mobile',viewport:{width:390,height:844}}];
export default defineConfig({
  testDir: '.', testMatch: 'web047.spec.ts', workers: 1, timeout: 180000,
  outputDir: '../test-results/web047', reporter: 'list', expect: {timeout: 20000},
  use: {...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5247', launchOptions: {args: browserGpuArgs}},
  projects: [
    ...(before ? sizes.map(({name,viewport})=>({name:name+'-before',testMatch:'web047.before.spec.ts',use:{baseURL:'http://127.0.0.1:5248',viewport}})) : []),
    ...sizes.map(({name,viewport})=>({name,use:{viewport}})),
  ],
  webServer: [
    {command:'bun run dev --port 5247',url:'http://127.0.0.1:5247',reuseExistingServer:false,env:mock},
    ...(before ? [{command:'bun run dev --config tests/web047.before.vite.ts --port 5248',url:'http://127.0.0.1:5248',reuseExistingServer:false,env:mock}] : []),
  ],
});
