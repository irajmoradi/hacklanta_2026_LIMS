// Run from apps/web through ops/remote_run.sh; no server or provider calls.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(resolve('package.json'));
const { chromium } = require('@playwright/test');
const root = resolve('../..');
const output = resolve(root, 'docs/architecture/artifacts');
await mkdir(output, { recursive: true });
const blocks = [...(await readFile(resolve(root, 'README.md'), 'utf8')).matchAll(/```mermaid\r?\n([\s\S]*?)```/g)];
if (blocks.length !== 3) throw Error('Expected three diagrams');
const config = resolve(output, 'puppeteer.json');
await writeFile(config, JSON.stringify({ executablePath: chromium.executablePath(), args: ['--no-sandbox'] }));
for (let i = 0; i < blocks.length; i++) {
  const input = resolve(output, `diagram-${i + 1}.mmd`);
  await writeFile(input, blocks[i][1]);
  for (const extension of ['svg', 'png']) {
    const result = spawnSync('npm', ['exec', '--yes', '--package=@mermaid-js/mermaid-cli@11', '--',
      'mmdc', '-p', config, '-i', input, '-o', resolve(output, `diagram-${i + 1}.${extension}`),
      '-b', 'white', '-w', '1800'], {
      env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: 'true' }, stdio: 'inherit', timeout: 300000,
    });
    if (result.status !== 0) throw Error(`Mermaid render ${i + 1}/${extension} failed (${result.status})`);
  }
}
console.log('All three README Mermaid diagrams rendered as SVG and PNG');
