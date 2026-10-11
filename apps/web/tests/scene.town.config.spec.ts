import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'scene.town.spec.ts', outputDir: '../src/scene/artifacts/test-results', workers: 1, timeout: 90000,
  use: {baseURL:'http://127.0.0.1:5198',viewport:{width:1920,height:1080},headless:process.env.SCENE_HARDWARE!=='1',launchOptions:{args:process.env.SCENE_HARDWARE==='1'?['--use-angle=d3d11']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{command:'bun run dev --port 5198',cwd:'..',url:'http://127.0.0.1:5198',reuseExistingServer:false,env:{VITE_MOCK:'0',VITE_DEMO_AUTH:'1',VITE_DEMO_USER:'13370000-0000-4000-8000-000000000001',VITE_VILLAGE_ID:'13370000-0000-4000-8000-000000000000'}},
});
