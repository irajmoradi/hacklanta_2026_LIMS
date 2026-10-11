import { useDemoSeat } from './demoSeat';
useDemoSeat();
import { test, expect } from '@playwright/test';
test('read-only real API shop screenshot',async({page})=>{
 page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
 page.on('response',r=>{if(r.url().includes('/api/') && !r.ok())console.log('API status',r.status(),new URL(r.url()).pathname);});
 await page.goto('/');
 await expect(page.locator('.mode-badge')).toHaveText('Connected');
 await page.getByRole('button',{name:'Shop',exact:true}).click();
 await expect(page.locator('.shop-item').first()).toBeVisible({timeout:30000});
 const dog=page.locator('.shop-item[data-item-id="pet_dog"]');
 await dog.scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/web021/shop-real.png'});
});
