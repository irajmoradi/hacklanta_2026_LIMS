import { test, expect } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat();
for (const [width,height] of [[1280,720],[1600,900],[2560,900]]) test(`HUD no overlap ${width}x${height}`, async({page}) => {
 await page.setViewportSize({width,height}); await page.goto('/');
 await expect(page.getByRole('button',{name:'My profile',exact:true})).toBeVisible();
 await expect(page.locator('.action-dock button')).toHaveText(['Check in','Village','My goal',/Weekly review/,'Compete','Mayor','Shop']);
 await expect(page.locator('.self-card,.challenge-peek')).toHaveCount(0);
 for(const selected of [false,true]) {
  if(selected) await page.getByRole('button',{name:'My profile',exact:true}).click();
  await expect(page.locator('.village-main')).toHaveCSS('margin-right',selected?`${Math.min(680,width*.54)}px`:'0px');
  const selectors=['.welcome','.dashboard','.action-dock','.neighbors-strip','.camera-hint'];
  const boxes=[];
  for(const selector of selectors) if(await page.locator(selector).isVisible()) boxes.push({selector,box:(await page.locator(selector).boundingBox())!});
  for(let i=0;i<boxes.length;i++) {
   const {box:a,selector}=boxes[i]; expect(a.x,selector).toBeGreaterThanOrEqual(0); expect(a.y+a.height,selector).toBeLessThanOrEqual(height);
   for(let j=i+1;j<boxes.length;j++) {const b=boxes[j].box;expect(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,`${selector} overlaps ${boxes[j].selector}`).toBe(true);}
  }
  await page.screenshot({animations:'disabled',path:`artifacts/web030/hud-${width}-${selected?'profile':'town'}.png`});
 }
});
for(const [width,height] of [[1440,900],[390,844]]) test(`profile tabs and thumbnails ${width}`,async({page})=>{
 await page.setViewportSize({width,height});await page.goto('/');await expect(page.getByRole('button',{name:'My profile',exact:true})).toBeVisible();await page.getByRole('button',{name:'My profile',exact:true}).click();
 const panel=page.getByRole('tabpanel');
 await expect(page.getByRole('tab')).toHaveText(['Overview','Outfit','House','Rewards','Activity']);
 await expect(page.getByRole('tab',{name:'Overview'})).toHaveAttribute('aria-selected','true');
 await expect(panel).toContainText('THIS WEEK');
 await page.screenshot({animations:'disabled',path:`artifacts/web030/overview-${width}.png`});
 await page.getByRole('tab',{name:'Rewards'}).click();
 await expect(panel).toContainText('Win a weekly crown');await expect(panel).toContainText('Check in 28 days in a row');
 await expect(panel.getByRole('progressbar')).toHaveAttribute('max','28');
 for(const image of await panel.locator('.reward-card img').all()){await image.scrollIntoViewIfNeeded();await expect(image).toHaveJSProperty('complete',true);expect(await image.evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBeGreaterThan(0);}
 await panel.evaluate(el=>el.scrollTop=0);await page.screenshot({animations:'disabled',path:`artifacts/web030/rewards-${width}.png`});
 await page.getByRole('tab',{name:'Outfit'}).click();await expect(panel.getByRole('region',{name:'Villager showcase',exact:true})).toBeVisible();
 await expect(panel.getByRole('region',{name:'Owned items',exact:true})).toBeVisible();
 await expect(panel.locator('details')).toHaveCount(0);await expect(panel.locator('.showcase-tile img').first()).toBeVisible();
 await expect(panel).toHaveCSS('opacity','1');
 for(const image of await panel.locator('.showcase-tile img').all()) {await image.scrollIntoViewIfNeeded();await expect(image).toHaveJSProperty('complete',true);}
 await panel.evaluate(el=>el.scrollTop=0);
 await page.waitForTimeout(1500); // Let the optional model finish its first frame for visual QA.
 await page.screenshot({animations:'disabled',path:`artifacts/web030/outfit-${width}.png`});
 await page.getByRole('tab',{name:'House',exact:true}).click();await expect(panel.getByRole('region',{name:'House showcase',exact:true})).toBeVisible();
 await panel.getByRole('button',{name:'Edit my house',exact:true}).click();await expect(panel.getByRole('button',{name:'Close house editor'})).toBeVisible();
 await page.getByRole('tab',{name:'Activity',exact:true}).click();await expect(panel.getByRole('region',{name:'Personal activity'})).toBeVisible();
 await page.getByRole('tab',{name:'Activity',exact:true}).press('Home');await expect(page.getByRole('tab',{name:'Overview'})).toBeFocused();
 await page.getByRole('button',{name:'Close profile',exact:true}).click();
 const header=(await page.locator('.topbar').boundingBox())!, portrait=(await page.getByRole('button',{name:'My profile',exact:true}).boundingBox())!;
 expect(portrait.y+portrait.height).toBeLessThanOrEqual(header.y+header.height);
 if(width < 700) await page.screenshot({animations:'disabled',path:`artifacts/web030/town-${width}.png`});
 await page.getByRole('button',{name:'Visit Lance',exact:true}).click();
 await expect(page.getByRole('tab')).toHaveCount(5);await page.getByRole('tab',{name:'House',exact:true}).click();
 await expect(page.getByRole('button',{name:'Edit my house',exact:true})).toHaveCount(0);
 await page.getByRole('tab',{name:'Rewards'}).click();await expect(panel).toContainText('Only equipped rewards are public. More may be hidden; private ownership is not shown.');
});

 test('owned outfit equip and colors persist, missing art uses a neutral fallback',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'My profile',exact:true}).click();
  await page.getByRole('tab',{name:'Outfit',exact:true}).click();
  const panel=page.getByRole('tabpanel');
  await panel.getByRole('button',{name:'Headphones',exact:true}).first().click();
  await panel.getByRole('button',{name:'Unequip Headphones',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Equip Headphones',exact:true})).toBeEnabled();
  await panel.getByRole('button',{name:'Equip Headphones',exact:true}).click();
  await expect(panel.getByRole('button',{name:'Unequip Headphones',exact:true})).toBeEnabled();
  await panel.getByRole('button',{name:'Choose colors',exact:true}).click();
  await panel.getByRole('textbox',{name:'Custom hex',exact:true}).fill('#446688');
  await panel.getByRole('button',{name:'Save colors',exact:true}).click();
  await expect(panel.getByRole('textbox',{name:'Custom hex',exact:true})).toHaveCount(0);
  const saved=await page.evaluate(async()=>{const {api}=await import('/src/api/client.ts' as string);const identity=await api.me(); const p=await api.profile(identity.villages[0].id,api.user);return p.villager.equipped.find((i:any)=>i.item_id==='hat_headphones')?.colors?.primary;});
  expect(saved).toBe('#446688');
  await panel.getByRole('button',{name:'Choose colors',exact:true}).click();
  await expect(panel.getByRole('textbox',{name:'Custom hex',exact:true})).toHaveValue('#446688');
  await panel.getByRole('button',{name:'Cancel colors',exact:true}).click();
  await page.route('**/thumbs/streak_flame_scarf.png',r=>r.fulfill({status:404,body:''}));
  await page.getByRole('tab',{name:'Rewards',exact:true}).click();
  const card=panel.locator('[data-item-id="streak_flame_scarf"]');await card.scrollIntoViewIfNeeded();
  await expect(card.locator('.neutral-item')).toBeVisible();await expect(card).toContainText('Check in 28 days in a row');
 });
