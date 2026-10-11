import {defineConfig} from '@playwright/test';
import base from './playwright.config';
import headStudio from './playwright.feat017.config';

// Combine the existing fixture and intercepted-API suites without contacting a live API.
export default defineConfig({
  ...base, timeout:90000, expect:{timeout:20000},
  outputDir:'test-results/integ015',
  reporter:[['list'],['json',{outputFile:'artifacts/integ015/e2e.json'}]],
  webServer:[...(Array.isArray(base.webServer) ? base.webServer : [base.webServer!]), headStudio.webServer as Exclude<typeof headStudio.webServer, unknown[] | undefined>, {command:'bun run preview --port 5197 --strictPort',url:'http://127.0.0.1:5197',reuseExistingServer:false}].map(server=>({...server,env:{...server.env,VILLAGE_API_URL:'http://127.0.0.1:9'}})),
  projects:[
    ...base.projects!.map(project=>project.name==='connection' ? {...project,testMatch:/(?:connection|settings|heads|web015-live|web016|feat012|vfx001|vfx001-transitions).spec.ts/} : project.name==='mock' ? {...project,testMatch:[project.testMatch!, 'colosseum.spec.ts'].flat()} : project),
    {name:'production',testDir:'./tests/perf',testMatch:'panels.spec.ts',use:{baseURL:'http://127.0.0.1:5197',viewport:{width:1440,height:1000}}},
    {name:'head-studio',timeout:headStudio.timeout,testMatch:'feat017.spec.ts',use:headStudio.use},
    {name:'integration',timeout:120000,testMatch:/(?:integ013|integ014|fix008-surfaces|web019|web021|web024|web027|web028|feat013|feat014|feat016|feat018|web030|web031|web033|web034|web035|web036|web037|web038|web039|fix013|fix014).spec.ts/,
      use:{...base.use,viewport:{width:1440,height:1000}}},
  ],
});
