import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const out = resolve('docs/submission/video/data/demo');
await mkdir(out, {recursive:true});
const browser = await chromium.launch({headless:false});
try {
 const page = await browser.newPage({viewport:{width:1920,height:1080}});
 await page.route('**/api/**', r => ['GET','HEAD','OPTIONS'].includes(r.request().method()) ? r.continue() : r.abort());
 await page.goto('http://localhost:4173/');
 await page.getByText('Connected',{exact:true}).waitFor();
 const snapshots: Record<string,string> = {};
 async function dump(name:string) { await page.waitForTimeout(1200); snapshots[name] = await page.locator('body').innerText(); snapshots[name+' buttons'] = JSON.stringify(await page.getByRole('button').evaluateAll(bs=>bs.map(b=>({text:b.textContent,aria:b.getAttribute('aria-label')})))); }
 async function close() { for(let i=0;i<4;i++){const b=page.getByRole('button',{name:'Close dialog',exact:true});if(await b.count())await b.last().click();} const p=page.getByRole('button',{name:'Close profile'});if(await p.count())await p.click(); }
 await dump('world');
 for(const name of ['Village','Gazette','Mayor','Week','Compete','Shop','AI at work','Inbox']) {
  await close(); await page.getByRole('button',{name,exact:true}).click(); await dump(name);
  if(name==='Village'){await page.getByRole('button',{name:'Our group photo',exact:true}).click();await dump('group');}
  if(name==='Compete'){await page.getByRole('button',{name:/Study streak/}).click();await dump('pot');}
 }
 await close();await page.getByRole('button',{name:'My profile',exact:true}).click();await dump('self');
 await page.getByRole('button',{name:'Settings',exact:true}).click();await dump('settings');
 await writeFile(out+'/inspect-v2.json',JSON.stringify(snapshots,null,2));
 console.log(JSON.stringify(snapshots,null,2));
}finally{await browser.close();}
