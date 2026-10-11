import { defineConfig } from '@playwright/test';
import original from '../playwright.config';
// Isolate regression servers from other Village worktrees using the standard ports.
export default defineConfig({ ...original, testDir: '.', outputDir: '../test-results/scene-regression',
  use: {...original.use, baseURL: 'http://127.0.0.1:5194'},
  projects: original.projects!.filter(project => process.env.SCENE_SKIP_AUTH !== '1' || project.name !== 'auth').map(project => ({...project, use: {...project.use,
    baseURL: project.name === 'auth' ? 'http://localhost:5177' : project.name === 'connection' ? 'http://127.0.0.1:5195' : 'http://127.0.0.1:5194'}})),
  webServer: (Array.isArray(original.webServer) ? original.webServer : []).filter(server => process.env.SCENE_SKIP_AUTH !== '1' || !server.url?.includes('5177')).map(server => ({...server, cwd: '..',
    command: server.command.replace(/517[45]/g, port => port.replace('517', '519')), url: server.url?.replace(/517[45]/g, port => port.replace('517', '519'))})),
});
