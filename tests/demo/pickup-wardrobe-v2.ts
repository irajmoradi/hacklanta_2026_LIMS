import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=resolve('docs/submission/video/data/demo');
const budget=JSON.parse(await readFile(out+'/v2-budget.json','utf8'));
const browser=await chromium.launch({headless:false});
const ctx=await browser.newContext({viewport:{width:1920,height:1080},recordVideo:{dir:out+'/v2_raw',size:{width:1920,height:1080}}});
const page=await ctx.newPage();page.setDefaultTimeout(15000);
await page.route('**/api/**',async r=>{
 const q=r.request(),path=new URL(q.url()).pathname;
 if(['GET','HEAD','OPTIONS'].includes(q.method()))return r.continue();
 if(q.method()==='POST'&&/\/inventory\/(un)?equip$/.test(path)&&budget.equip<2){budget.equip++;await writeFile(out+'/v2-budget.json',JSON.stringify(budget,null,2));return r.continue();}
 return r.abort();
});
try{
 await page.goto('http://localhost:4173/');await page.getByText('Connected',{exact:true}).waitFor();
 await page.getByRole('button',{name:'My profile',exact:true}).click();await page.getByRole('tab',{name:'Wardrobe',exact:true}).click();
 await page.locator('.shop-item').first().waitFor();
 await writeFile(out+'/v2-wardrobe-inspect.txt',await page.locator('body').innerText());
 const glasses=page.locator('.shop-item').filter({hasText:'Round Glasses'});
 await glasses.scrollIntoViewIfNeeded();
 await page.evaluate(()=>{const e=document.createElement('div');e.setAttribute('popover','manual');e.style.cssText='position:fixed;inset:auto auto 100px 32px;margin:0;width:555px;padding:22px;background:#122b29f5;border:1px solid #90ac91;border-radius:16px;color:white;font:21px/1.5 Arial;pointer-events:none';e.textContent='MAKE IT YOUR OWN · Remove and re-equip owned Round Glasses. The preview updates from real inventory responses; no XP purchase.';document.body.append(e);e.showPopover();});
 const start=await page.evaluate(()=>performance.now());await page.waitForTimeout(1500);
 await glasses.getByRole('button',{name:'Unequip Round Glasses',exact:true}).click();
 await glasses.getByRole('button',{name:'Equip Round Glasses',exact:true}).waitFor();await page.waitForTimeout(1500);
 await glasses.getByRole('button',{name:'Equip Round Glasses',exact:true}).click();
 await glasses.getByRole('button',{name:'Unequip Round Glasses',exact:true}).waitFor();
 await page.locator('.wardrobe-preview').scrollIntoViewIfNeeded();
 await page.screenshot({path:out+'/v2_qa/wardrobe-pickup.png'});
 const elapsed=await page.evaluate(()=>performance.now())-start;await page.waitForTimeout(Math.max(0,12000-elapsed));
 const end=await page.evaluate(()=>performance.now());await ctx.close();const rawVideo=await page.video()!.path();
 await writeFile(out+'/v2-wardrobe-pickup.json',JSON.stringify({rawVideo,storySeconds:(end-start)/1000,replaces:'Wardrobe equip',budget,reason:'Fresh context avoids asynchronous demo identity switch; actual inventory unequip/equip verified.'},null,2));
 console.log('Wardrobe pickup: both real inventory updates verified');
}finally{await writeFile(out+'/v2-wardrobe-final.txt',await page.locator('body').innerText().catch(()=>''));await browser.close();}
