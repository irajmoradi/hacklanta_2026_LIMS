import { defineConfig } from '../apps/web/node_modules/@playwright/test/index';
export default defineConfig({
 testDir:'../apps/web/tests',testMatch:'colosseum.spec.ts',workers:1,timeout:60000,
 outputDir:'./previews/tests_010',reporter:'list',expect:{timeout:15000},
 use:{baseURL:'http://127.0.0.1:5184',viewport:{width:1440,height:1000},launchOptions:{args:['--use-angle=d3d11']}},
 projects:[{name:'mock'}],
});
