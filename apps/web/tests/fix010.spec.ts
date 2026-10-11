import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { useDemoSeat } from './demoSeat';
useDemoSeat();
const own=(page:Page)=>page.locator('[data-player="true"]');
const inspect=(page:Page)=>page.evaluate(async()=> (await import('/tests/fix010Scene.ts' as string)).inspect());
async function start(page:Page) {
 await page.goto('/');await expect(own(page)).toBeVisible();
 await page.getByRole('button',{name:'Dismiss walking hint'}).click();
 await page.keyboard.down('s');await page.waitForTimeout(1500);await page.keyboard.up('s');
 await page.keyboard.press('Shift+c');
}
test('Space raises the actual hand above Head; number keys, touch, guards and return to idle',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
 await expect.poll(async()=>!!(await inspect(page)).hand).toBe(true);
 await page.evaluate(async()=> (await import('/tests/fix010Scene.ts' as string)).closeup());
 await mkdir('artifacts/fix010',{recursive:true});
 // Freeze only the emote clock so mid-pose world-space assertions are deterministic at any GPU speed.
 await page.evaluate(()=>{const real=performance.now.bind(performance);(window as any).emoteRealNow=real;(window as any).emoteNow=real();performance.now=()=> (window as any).emoteNow;});
 await page.keyboard.press('Space');
 await page.evaluate(()=>{(window as any).emoteNow+=700;});
 await expect.poll(async()=>{const p=await inspect(page);return p.hand![1]-p.head![1];}).toBeGreaterThan(.2);
 await expect(own(page).getByTestId('activity-badge')).toHaveText('Waving');
 await page.screenshot({path:'artifacts/fix010/wave.png'});
 expect((await inspect(page)).elbow).toBeCloseTo(Math.PI/6,1);
 await page.evaluate(()=>{(window as any).emoteNow+=800;});
 await expect(own(page).getByTestId('activity-badge')).toHaveText('Taking a break');
 await expect.poll(async()=>Math.abs((await inspect(page)).elbow!)).toBeLessThan(.001);
 await page.evaluate(()=>{performance.now=(window as any).emoteRealNow;});
 for(const [key,label] of [['1','Waving'],['2','Cheering'],['3','Dancing']]) {
  await page.keyboard.press(key);await expect(own(page).getByTestId('activity-badge')).toHaveText(label);await page.waitForTimeout(1500);
 }
 await page.getByRole('button',{name:'Emotes',exact:true}).tap();
 await page.getByRole('button',{name:'Cheer2',exact:true}).tap();
 await expect(own(page).getByTestId('activity-badge')).toHaveText('Cheering');
 await page.waitForTimeout(1600);
 await page.getByRole('button',{name:'Open Settings',exact:true}).click();await page.keyboard.press('2');
 await expect(own(page).getByTestId('activity-badge')).not.toHaveText('Cheering');
 await page.getByRole('button',{name:'Close dialog'}).click();
 await page.getByLabel('Play as').focus();await page.keyboard.press('3');
 await expect(own(page).getByTestId('activity-badge')).not.toHaveText('Dancing');
 await expect(page.locator('[data-player="true"]')).toHaveCount(1);
 await expect(page.locator('[data-testid="villager-Lance"]')).toHaveAttribute('data-controlled','false');
 expect(errors).toEqual([]);
 const video=page.video();await page.close();if(video)await video.saveAs('artifacts/fix010/emotes.webm');
});
test('offline fixture geometry waves and supports touch emotes',async({page})=>{
 await page.route('**/models/**',route=>route.abort());await start(page);
 await page.keyboard.press('1');await expect(own(page).getByTestId('activity-badge')).toHaveText('Waving');
 await page.getByRole('button',{name:'Emotes',exact:true}).tap();await page.getByRole('button',{name:'Dance spin3',exact:true}).tap();
 await expect(own(page).getByTestId('activity-badge')).toHaveText('Dancing');
 await page.waitForTimeout(1600);await expect(own(page).getByTestId('activity-badge')).toHaveText('Taking a break');
});
