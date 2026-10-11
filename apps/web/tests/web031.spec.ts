import { test, expect } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat();
test('widgets expand, drag, minimize, filter and persist per seat', async ({page}) => {
 await page.goto('/');
 const cards=page.locator('.dashboard-card');
 await expect(cards.first()).toHaveAttribute('data-widget','feed');
 await expect(cards.first().locator('article')).toHaveCount(4);
 await expect(cards.first().locator('time')).toHaveCount(4);
 await page.getByRole('button',{name:'Pop out Around the village',exact:true}).click();
 const popup=page.getByRole('dialog',{name:'Around the village',exact:true});
 await expect(popup).toBeVisible();await expect(popup.locator('time').first()).toBeVisible();
 const initialCount=await popup.locator('article').count();if(await popup.getByRole('button',{name:'Load more',exact:true}).isEnabled()){await popup.getByRole('button',{name:'Load more',exact:true}).click();expect(await popup.locator('article').count()).toBeGreaterThan(initialCount);}
 await popup.getByLabel('Activity filter').selectOption('mine');
 await expect(popup.getByRole('button',{name:'Load more',exact:true})).toBeVisible();
 const before=(await popup.boundingBox())!;const header=popup.locator('header').first();const box=(await header.boundingBox())!;
 await page.mouse.move(box.x+80,box.y+20);await page.mouse.down();await page.mouse.move(box.x+140,box.y+70,{steps:8});await page.mouse.up();
 await expect.poll(async()=>Math.round((await popup.boundingBox())!.x)).toBeGreaterThan(Math.round(before.x)+30);
 await page.keyboard.press('Escape');await expect(popup).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Pop out Around the village',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Pop out Your corner',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('XP breakdown');await expect(page.locator('.streak-calendar span')).toHaveCount(28);
 await page.getByRole('button',{name:'Minimize Your corner',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'Options for Around the village',exact:true}).click();await page.getByRole('button',{name:'Move down',exact:true}).click();
 await expect(cards.first()).toHaveAttribute('data-widget','corner');await page.getByRole('button',{name:'Hide widget',exact:true}).click();
 await page.reload();await expect(cards.first()).toHaveAttribute('data-widget','corner');await expect(page.locator('[data-widget="feed"]')).toHaveCount(0);
 await page.getByText('Hidden widgets (1)',{exact:true}).click();await page.getByRole('button',{name:'Show Around the village',exact:true}).click();await expect(page.locator('[data-widget="feed"]')).toBeVisible();
 await page.getByLabel('Play as',{exact:true}).selectOption({label:'Lance'});await expect(cards.first()).toHaveAttribute('data-widget','feed');
});
test('camera zoom collapses and restores dashboard, manual collapse survives reset',async({page})=>{
 await page.goto('/');const dashboard=page.getByRole('complementary',{name:'Village dashboard'});await expect(dashboard).toHaveAttribute('data-collapsed','false');
 await expect(page.locator('canvas').first()).toBeVisible();await page.waitForTimeout(3000);
 await page.mouse.move(850,400);for(let i=0;i<18;i++){await page.mouse.wheel(0,-100);await page.waitForTimeout(40);}await expect(dashboard).toHaveAttribute('data-collapsed','true');
 await page.getByRole('button',{name:'Reopen dashboard'}).click();await expect(dashboard).toHaveAttribute('data-collapsed','false');
 await page.getByRole('button',{name:'Reset camera'}).click();await expect(dashboard).toHaveAttribute('data-collapsed','false');
 await page.mouse.move(850,400);for(let i=0;i<18;i++){await page.mouse.wheel(0,-100);await page.waitForTimeout(40);}await expect(dashboard).toHaveAttribute('data-collapsed','true');
 await page.getByRole('button',{name:'Reset camera'}).click();await expect(dashboard).toHaveAttribute('data-collapsed','false');
 await page.getByRole('button',{name:'Collapse dashboard'}).click();await page.getByRole('button',{name:'Reset camera'}).click();await expect(dashboard).toHaveAttribute('data-collapsed','true');
 await page.reload();await expect(dashboard).toHaveAttribute('data-collapsed','true');
});
test('clean view exits on key, villager and building with the intended action',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Enter clean fullscreen view'}).click();
 await expect(page.locator('.app')).toHaveClass(/clean-view/);await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);await expect(page.locator('.villager-label').first()).toBeVisible();await page.screenshot({animations:'disabled',path:'artifacts/web031/clean-view.png'});await expect(page.locator('.topbar')).toBeHidden();await expect(page.locator('.action-dock')).toBeHidden();await expect(page.locator('.player-hint')).toBeHidden();
 await page.keyboard.press('x');await expect(page.locator('.app')).not.toHaveClass(/clean-view/);
 await page.keyboard.press('f');await expect(page.locator('.app')).toHaveClass(/clean-view/);
 const villager=page.locator('[data-testid^="villager-"]').filter({visible:true}).first();await expect(villager).toBeVisible();await villager.click();
 await expect(page.locator('.app')).not.toHaveClass(/clean-view/);await expect(page.getByRole('button',{name:'Close profile',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Close profile',exact:true}).click();await page.keyboard.press('f');
 await page.getByRole('button',{name:'Read the Gazette at the plaza notice board',exact:true}).click();
 await expect(page.locator('.app')).not.toHaveClass(/clean-view/);await expect(page.getByRole('dialog')).toContainText('The Village Gazette');
});
test('fullscreen rejection keeps clean view usable and typing F is safe',async({page})=>{
 await page.addInitScript(()=>{document.documentElement.requestFullscreen=()=>Promise.reject(new Error('Unavailable'));});
 await page.goto('/');await page.getByRole('button',{name:'Enter clean fullscreen view'}).click();await expect(page.locator('.app')).toHaveClass(/clean-view/);await page.keyboard.press('Escape');await expect(page.locator('.topbar')).toBeVisible();
 await page.getByRole('button',{name:'Check in',exact:true}).last().click();await page.getByRole('button',{name:/Daily note/}).click();await page.locator('textarea').first().fill('f');await expect(page.locator('.app')).not.toHaveClass(/clean-view/);
});
for(const [width,height] of [[1280,720],[1600,900],[2560,900],[390,844]])test(`dashboard layout and screenshots ${width}`,async({page})=>{
 await page.setViewportSize({width,height});if(width===390)await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('.dashboard-card').first()).toBeVisible();
 const selectors=['.welcome','.dashboard','.action-dock','.neighbors-strip','.camera-hint'];
 const boxes=[];for(const selector of selectors)if(await page.locator(selector).isVisible())boxes.push({selector,box:(await page.locator(selector).boundingBox())!});
 for(let i=0;i<boxes.length;i++){const {box:a,selector}=boxes[i];expect(a.x).toBeGreaterThanOrEqual(0);expect(a.y+a.height).toBeLessThanOrEqual(height);for(let j=i+1;j<boxes.length;j++){const b=boxes[j].box;expect(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,`${selector} overlaps ${boxes[j].selector}`).toBe(true);}}
 await page.screenshot({animations:'disabled',path:`artifacts/web031/dashboard-${width}.png`});
 await page.getByRole('button',{name:'Pop out Around the village',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.screenshot({animations:'disabled',path:`artifacts/web031/popout-${width}.png`});
});
