// Runs with a disposable loopback API; the isolated harness assigns free ports.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(resolve('package.json'));
const { chromium } = require('@playwright/test');
const root = resolve('../..');
const output = resolve(root, 'docs/architecture/artifacts');
await mkdir(output, { recursive: true });
const api = process.env.VILLAGE_API_URL;
const port = process.env.DOCS_WEB_PORT || '4174';
const origin = `http://127.0.0.1:${port}`;
if (!api || !/^http:\/\/127\.0\.0\.1:\d+$/.test(api)) throw Error('Disposable runner API required');
const health = await (await fetch(`${api}/api/health`)).json();
if (!health.ok || health.db !== 'up') throw Error('Scratch API not healthy');
const browser = await chromium.launch({ headless: true });
try {
  for (const mock of ['1', '0']) {
    const child = spawn('bun', ['run', 'dev', '--host', '127.0.0.1', '--port', port], {
      env: { ...process.env, VITE_MOCK: mock, VITE_DEMO_AUTH: '1' }, stdio: 'ignore', detached: true,
    });
    try {
      let ready = false;
      for (let n = 0; n < 100; n++) {
        if (child.exitCode !== null) throw Error(`Vite exited ${child.exitCode}`);
        try { ready = (await fetch(origin)).ok; } catch {}
        if (ready) break;
        await new Promise(r => setTimeout(r, 200));
      }
      if (!ready) throw Error('Vite startup timed out');
      if (mock === '0') {
        const proxied = await (await fetch(`${origin}/api/health`)).json();
        if (proxied.db !== 'up') throw Error('Connected Vite proxy failed');
      }
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      await page.getByText('Play as', { exact: false }).first().waitFor({ timeout: 45000 });
      await page.screenshot({ path: resolve(output, mock === '1' ? 'fixture-start.png' : 'connected-start.png') });
      if (errors.length) throw Error(`Browser page errors: ${errors.length}`);
      await page.close();
      console.log(`README Vite mode ${mock === '1' ? 'fixture' : 'connected'}: page mounted; no page errors`);
    } finally {
      try { process.kill(-child.pid, 'SIGTERM'); } catch {}
      await new Promise(r => setTimeout(r, 500));
    }
  }
} finally { await browser.close(); }
const markdown = await readFile(resolve(root, 'README.md'), 'utf8');
const blocks = [...markdown.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)];
for (let i = 0; i < blocks.length; i++) await writeFile(resolve(output, `diagram-${i + 1}.mmd`), blocks[i][1]);
await writeFile(resolve(output, 'puppeteer.json'), JSON.stringify({ executablePath: chromium.executablePath(), args: ['--no-sandbox'] }));
console.log(`Extracted ${blocks.length} Mermaid diagrams; scratch API health and connected proxy passed`);
