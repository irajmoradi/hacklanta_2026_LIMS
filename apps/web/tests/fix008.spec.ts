import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('every outfit pair on five generated villagers and the base head', async ({ page }) => {
  const errors: string[]=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.route('**/api/**', route=>route.request().method()==='GET'?route.continue():route.abort());
  await page.goto('/tests/fix008.html');await page.waitForFunction(()=>(window as any).fitMatrix);
  const combinations: string[][]=await page.evaluate(()=>(window as any).fitMatrix.combinations);
  const requiredPairs:number=await page.evaluate(()=>(window as any).fitMatrix.requiredPairs);
  const covered=new Set(combinations.flatMap(row=>row.slice(0,5).flatMap((v,i)=>row.slice(0,5).slice(i+1).map((w,j)=>JSON.stringify([i,v,i+j+1,w])))));
  expect(covered.size).toBe(requiredPairs);
  const output=process.env.FIT_MATRIX_OUTPUT ?? 'artifacts/fix012/pairs';await mkdir(output,{recursive:true});
  const baseline=process.env.FIX008_BASELINE==='1';
  const people=[];
  for(const [name,seat] of [['iraj',1],['lance',2],['stefanny',3],['maya',4],['mario',5],['base',0]] as const) {
    const headSource=await page.evaluate(seat=>(window as any).fitMatrix.person(seat),seat);
    await page.evaluate(count=>{
      const sheet=document.createElement('canvas');sheet.width=2400;sheet.height=Math.ceil(count/10)*204;
      (window as any).matrixSheet=sheet;
    },combinations.length);
    const results=[];
    for(const [index,row] of combinations.entries()) {
      const result=await page.evaluate(async ({row,index})=>{
        const result=(window as any).fitMatrix.outfit(row);
        const image=new Image();image.src=result.image;await image.decode();
        const ctx=(window as any).matrixSheet.getContext('2d');const x=index%10*240,y=Math.floor(index/10)*204;
        ctx.fillStyle='#edf0f3';ctx.fillRect(x,y,240,204);ctx.drawImage(image,x,y,240,180);
        ctx.fillStyle=result.failures.length?'#a00':'#163';ctx.font='10px sans-serif';ctx.fillText(`${index}: ${row.filter(Boolean).join(' / ')}`,x+2,y+192,236);
        delete result.image;return result;
      },{row,index});
      results.push({index,...result});
    }
    const image=await page.evaluate(()=>(window as any).matrixSheet.toDataURL('image/png') as string);
    await writeFile(`${output}/${baseline?'before_':'matrix_'}${name}.png`,Buffer.from(image.split(',')[1],'base64'));
    people.push({name,headSource,combinations:results.length,failures:results.filter(r=>r.failures.length).length,results});
    console.log(`${name}: ${results.length} combinations, ${people.at(-1)!.failures} failures`);
  }
  expect(new Set(people.filter(p=>p.name!=='base').map(p=>p.headSource.hashes.join(':'))).size).toBe(5);
  const report={phase:baseline?'before':'after',requiredPairs,coveredPairs:covered.size,combinations:people.reduce((n,p)=>n+p.combinations,0),failures:people.reduce((n,p)=>n+p.failures,0),errors,people};
  await writeFile(`${output}/${baseline?'before':'report'}.json`,JSON.stringify(report,null,2));
  await writeFile(`${output}/summary.json`,JSON.stringify({combinations:report.combinations,failures:report.failures,
    requiredPairs,coveredPairs:covered.size,errors,people:people.map(p=>({name:p.name,combinations:p.combinations,failures:p.failures,
      minBodyHeightRatio:Math.min(...p.results.map(r=>r.body.height/r.body.baseBodyHeight)),
      culledBodyCount:p.results.reduce((n,r)=>n+r.body.culledBody.length,0)}))},null,2));
  expect(errors).toEqual([]);
  if(!baseline)expect(report.failures).toBe(0);
});
