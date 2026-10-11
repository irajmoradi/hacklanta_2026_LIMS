import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const phase = process.argv[2] ?? 'after';
const output = 'artifacts/fix012';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  if (phase === 'crops') {
    for (const name of ['iraj','mario']) for (const version of ['before','after']) {
      const data = `data:image/png;base64,${(await readFile(`${output}/${version}_${name}.png`)).toString('base64')}`;
      const crop = await page.evaluate(async data => {
        const image = new Image(); image.src=data; await image.decode();
        const c=document.createElement('canvas');c.width=960;c.height=320;
        c.getContext('2d').drawImage(image,0,0,480,160,0,0,960,320);return c.toDataURL();
      }, data);
      await writeFile(`${output}/${version}_${name}_crop.png`,Buffer.from(crop.split(',')[1],'base64'));
    }
    process.exitCode=0;
  } else {
  page.on('pageerror', e => console.error(e.message));
  await page.route('**/api/**', r => r.request().method() === 'GET' ? r.continue() : r.abort());
  await page.goto('http://127.0.0.1:5298/tests/fix008.html');
  await page.waitForFunction(() => window.fitMatrix);
  const results = [];
  for (const [name, seat] of [['iraj', 1], ['mario', 5]]) {
    await page.evaluate(seat => window.fitMatrix.person(seat), seat);
    const result = await page.evaluate(() => window.fitMatrix.outfit(['hat_cap']));
    await writeFile(`${output}/${phase}_${name}.png`, Buffer.from(result.image.split(',')[1], 'base64'));
    delete result.image; results.push({ name, ...result });
  }
  await writeFile(`${output}/${phase}_caps.json`, JSON.stringify(results, null, 2));
  }
} finally { await browser.close(); }
