import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('all head items seat on all five villagers and the offline preset', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/**', r => r.request().method() === 'GET' ? r.continue() : r.abort());
  await page.goto('/tests/fix008.html'); await page.waitForFunction(() => (window as any).fitMatrix);
  const hats: string[] = await page.evaluate(() => (window as any).fitMatrix.hats);
  const output = 'artifacts/fix012'; await mkdir(output, {recursive:true});
  const people = [];
  for (const [name, seat] of [['iraj',1],['lance',2],['stefanny',3],['maya',4],['mario',5],['base',0]] as const) {
    const source = await page.evaluate(seat => (window as any).fitMatrix.person(seat), seat);
    await page.evaluate(count => { const c=document.createElement('canvas'); c.width=1920; c.height=Math.ceil(count/4)*384; (window as any).hatSheet=c; }, hats.length);
    const results = [];
    for (const [index, id] of hats.entries()) {
      results.push(await page.evaluate(async ({id,index}) => {
        const result=(window as any).fitMatrix.outfit([id]);
        const image=new Image(); image.src=result.image; await image.decode();
        const ctx=(window as any).hatSheet.getContext('2d'),x=index%4*480,y=Math.floor(index/4)*384;
        ctx.fillStyle='#edf0f3';ctx.fillRect(x,y,480,384);ctx.drawImage(image,x,y);
        ctx.fillStyle=result.failures.length?'#a00':'#163';ctx.font='16px sans-serif';ctx.fillText(id,x+8,y+378);
        delete result.image; return result;
      }, {id,index}));
    }
    const image=await page.evaluate(() => (window as any).hatSheet.toDataURL());
    await writeFile(`${output}/matrix_${name}.png`, Buffer.from(image.split(',')[1], 'base64'));
    people.push({name,source,results});
    console.log(name, results.flatMap(r=>r.failures));
  }
  await writeFile(`${output}/seating.json`, JSON.stringify({hats,people,errors},null,2));
  expect(errors).toEqual([]);
  expect(new Set(people.filter(p=>p.name!=='base').map(p=>p.source.hashes.join(':'))).size).toBe(5);
  expect(people.flatMap(p=>p.results.flatMap(r=>r.failures))).toEqual([]);
});
