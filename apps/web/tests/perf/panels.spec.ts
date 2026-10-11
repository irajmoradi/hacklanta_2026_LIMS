import {expect,test} from '@playwright/test';
import {useDemoSeat} from '../demoSeat';
useDemoSeat();

for (const offline of [false,true]) test(`production panels and town survive offline models=${offline}`,async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  if(offline)await page.route('**/models/**',route=>route.fulfill({status:404,body:''}));
  await page.goto('/');
  await expect(page.getByTestId('villager-Iraj')).toBeVisible();
  await page.getByRole('button',{name:'My profile',exact:true}).click();
  await page.getByRole('tab',{name:'Outfit',exact:true}).click();
  await expect(page.locator('.showcase-preview canvas')).toBeVisible();
  await page.getByRole('button',{name:'Customize my avatar',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Idle activity',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'House',exact:true}).click();
  await page.getByRole('button',{name:'Edit my house',exact:true}).click();
  await expect(page.locator('.house-editor')).toBeVisible();
  await page.getByRole('button',{name:'Close profile',exact:true}).click();
  await page.getByRole('button',{name:'Community Hall',exact:true}).click();
  const hall=page.getByRole('dialog',{name:'Community Hall interior'});
  await expect(hall.locator('canvas')).toBeVisible();
  await hall.getByRole('tab',{name:'Floor 2',exact:true}).click();
  await expect(hall.getByRole('tab',{name:'Floor 2',exact:true})).toHaveAttribute('aria-selected','true');
  await page.keyboard.press('Escape');
  await expect(hall).toBeHidden();
  await page.getByRole('button',{name:'Reading list',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Reading list',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Shop',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'The little clothing shop'})).toBeVisible();
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.getByRole('button',{name:'Compete',exact:true}).click();
  await expect(page.locator('.arena-header')).toBeVisible();
  await page.locator('.arena-header').getByRole('button',{name:'← Village',exact:true}).click();
  await expect(page.locator('.scene canvas')).toBeVisible();
  await page.getByRole('button',{name:'Pop out Around the village',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Around the village'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog',{name:'Around the village'})).toHaveCount(0);
  await page.getByRole('button',{name:'Reset camera',exact:true}).click();
  await page.waitForTimeout(500);
  await page.screenshot({path:`artifacts/integ015/panels-${offline?'offline':'models'}.png`});
  expect(errors).toEqual([]);
});

test('production GLBs negotiate gzip and versioned immutable caching',async({request})=>{
  const html=await (await request.get('/')).text();
  const model=html.match(/href="([^" ]*villager_base\.glb[^" ]*)"/)![1];
  const compressed=await request.get(model,{headers:{'Accept-Encoding':'gzip'}});
  expect(compressed.headers()['content-encoding']).toBe('gzip');
  expect(compressed.headers()['cache-control']).toContain('immutable');
  const original=await request.get('/models/villager_base.glb',{headers:{'Accept-Encoding':'identity'}});
  expect(original.headers()['cache-control']).toBe('public, no-cache');
  expect(await compressed.body()).toEqual(await original.body());
  expect(Number(compressed.headers()['content-length'])).toBeLessThan(Number(original.headers()['content-length']));
});


test('every current GLB has a lossless production sidecar, including new interiors and furniture', async ({}, info) => {
  const {readdirSync,readFileSync,mkdirSync,writeFileSync}=await import('node:fs');
  const {gunzipSync}=await import('node:zlib');
  const models=readdirSync('public/models').filter(name=>name.endsWith('.glb'));
  expect(models.length).toBeGreaterThan(0);
  const rows=models.map(name=>{
    const original=readFileSync(`public/models/${name}`);
    const gzip=readFileSync(`${info.project.metadata.buildDir || 'dist'}/models/${name}.gz`);
    expect(gunzipSync(gzip).equals(original),name).toBe(true);
    return {name,originalBytes:original.length,gzipBytes:gzip.length};
  });
  mkdirSync('artifacts/integ015',{recursive:true});
  writeFileSync('artifacts/integ015/model-compression.json',JSON.stringify({
    count:rows.length,originalBytes:rows.reduce((n,r)=>n+r.originalBytes,0),
    gzipBytes:rows.reduce((n,r)=>n+r.gzipBytes,0),models:rows,
  },null,2));
});
