import { useDemoSeat } from './demoSeat';
useDemoSeat();
import { test, expect } from '@playwright/test';

test('locked pet explains prerequisites, jumps to backyard; failed buy shows API detail',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Shop',exact:true})).toBeVisible();
 await page.evaluate(async()=>{
  const {api}=await import('/src/api/client.ts' as string);
  const original=api.shop.bind(api);
  api.shop=async(vid:string)=>{const s=await original(vid);return {...s,unlocks:[],items:s.items.map((i:any)=>({...i,owned:i.id==='house_backyard'?false:i.owned}))};};
 });
 await page.getByRole('button',{name:'Shop',exact:true}).click();
 await page.getByRole('tab',{name:'Farm Store',exact:true}).click();
 const dog=page.locator('.shop-item[data-item-id="pet_dog"]');
 await expect(dog.locator('.shop-state')).toHaveText('Locked');
 await expect(dog).toContainText('Needs Backyard (100 coins) first');
 await expect(dog).toContainText('Unlocks when the village builds the Pet Shelter');
 await expect(dog.getByRole('button',{name:'Buy Village Dog',exact:true})).toBeDisabled();
 await dog.getByRole('button',{name:'View Backyard'}).click();
 await expect(page.locator('.shop-item[data-item-id="house_backyard"]')).toBeFocused();
 await page.route('**/api/villages/*/shop/buy',r=>r.fulfill({status:409,json:{detail:'Requires building pet_shelter (409 detail)'}}));
 await page.evaluate(async()=>{const {api,VillageApi}=await import('/src/api/client.ts' as string);const live=new VillageApi();api.buy=live.buy.bind(live);});
 await page.getByRole('button',{name:'Buy Backyard',exact:true}).click();
 await expect(page.locator('.village-toast')).toContainText('Requires building pet_shelter (409 detail)');
 await page.screenshot({path:'test-results/web021/shop-mock.png'});
});

test('house ink appears on hover, keyboard focus and selection; profile outfit focuses shop',async({page})=>{
 await page.goto('/');
 const house=page.getByRole('button',{name:"Open Lance's house profile",exact:true});
 await expect(house).toHaveCSS('opacity','0');
 await expect.poll(async()=>{await house.hover();return house.evaluate(el=>getComputedStyle(el).opacity);}).toBe('1');
 await page.mouse.move(5,5);await expect(house).toHaveCSS('opacity','0');
 await house.focus();await expect(house).toHaveCSS('opacity','1');
 await house.press('Enter');
 await expect(page.locator('.profile-name h2')).toHaveText('Lance');
 await expect(house).toHaveClass(/revealed/);
 await page.getByRole('tab',{name:'Outfit',exact:true}).click();
 await page.getByRole('region',{name:'Villager showcase',exact:true}).getByRole('button',{name:'Festival Hat',exact:true}).click();
 await page.getByRole('button',{name:'View Festival Hat in shop',exact:true}).click();
 await expect(page.locator('.shop-item[data-item-id="hat_festival"]')).toBeFocused();
 await expect(page.getByRole('button',{name:'Buy Festival Hat',exact:true})).toBeEnabled();
});

for(const [width,height] of [[1280,720],[1600,900],[2560,900]]) test(`HUD avoids overlap at ${width}x${height}, including profile`,async({page})=>{
 await page.setViewportSize({width,height});await page.goto('/');
 await expect(page.getByRole('button',{name:'My profile',exact:true})).toBeVisible();
 for(const selected of [false,true]){
  if(selected) await page.getByRole('button',{name:'My profile',exact:true}).click();
  await expect(page.locator('.village-main')).toHaveCSS('margin-right',selected?`${Math.min(680,width*.54)}px`:'0px');
  const boxes=[];
  for(const selector of ['.action-dock','.camera-hint','.welcome','.dashboard','.neighbors-strip']) {
   if(await page.locator(selector).isVisible()) boxes.push(await page.locator(selector).boundingBox());
  }
  for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++){
   const a=boxes[i]!,b=boxes[j]!;
   expect(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y).toBe(true);
  }
  for(const b of boxes){expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.y+b!.height).toBeLessThanOrEqual(height);}
  await page.screenshot({path:`test-results/web021/hud-${width}-${selected?'profile':'town'}.png`});
 }
});

 test('profile owned items and earn-only items retain purchase restrictions',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'My profile',exact:true}).click();
  await page.getByRole('tab',{name:'Outfit',exact:true}).click();
 await page.getByRole('region',{name:'Villager showcase',exact:true}).getByRole('button',{name:'Headphones',exact:true}).first().click();
  await page.getByRole('button',{name:'View Headphones in shop',exact:true}).click();
  const owned=page.locator('.shop-item[data-item-id="hat_headphones"]');
  await expect(owned).toBeFocused();await expect(owned.locator('.shop-state')).toHaveText('Owned');
  await expect(owned.getByRole('button',{name:'Buy Headphones',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.getByRole('button',{name:'Close profile',exact:true}).click();
  await page.evaluate(async()=>{const {api}=await import('/src/api/client.ts' as string);const original=api.shop.bind(api);api.shop=async(vid:string)=>{const s=await original(vid);return {...s,items:s.items.map((i:any)=>i.id==='hat_festival'?{...i,source:'Win the Harvest Festival'}:i)};};});
  await page.getByRole('button',{name:'Shop',exact:true}).click();
  const reward=page.locator('.shop-item[data-item-id="hat_festival"]');
  await expect(reward).toContainText('Earn-only: Win the Harvest Festival');
  await expect(reward.getByRole('button',{name:'Buy Festival Hat',exact:true})).toHaveCount(0);
 });
 test('touch tap reveals house and opens its owner',async({browser,baseURL})=>{
  const context=await browser.newContext({hasTouch:true,viewport:{width:1280,height:720}});
  await context.addInitScript(() => localStorage.setItem('village:seat:mock','00000000-0000-4000-8000-000000000001'));
  const page=await context.newPage();await page.goto(baseURL!);
  const house=page.getByRole('button',{name:"Open Lance's house profile",exact:true});
  await expect(house).toHaveCSS('opacity','0');await house.tap();
  await expect(page.locator('.profile-name h2')).toHaveText('Lance');
  await expect(house).toHaveClass(/revealed/);await context.close();
 });
