import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Dedicated ports avoid other worktrees' browser suites and shared preview servers.
const isolated = (value: string) => value.replace(/5174|5175|5177/g, port => ({
  '5174': '5584', '5175': '5585', '5177': '5587',
})[port]!);

export default defineConfig({
  ...base,
  outputDir: 'test-results/integ004',
  use: { ...base.use, baseURL: isolated(base.use!.baseURL!) },
  projects: base.projects!.map(project => ({ ...project,
    ...(project.use?.baseURL ? { use: { ...project.use, baseURL: isolated(project.use.baseURL) } } : {}),
  })),
  webServer: (Array.isArray(base.webServer) ? base.webServer : [base.webServer!]).map(server => ({
    ...server, command: isolated(server.command), url: isolated(server.url!),
  })),
});
