import { test, expect } from '@playwright/test';
import { MockApi } from '../src/api/mock';
import { DEMO_USER_ID } from '../src/api/fixtures';

test.beforeEach(async ({page}) => { await page.addInitScript((id) => localStorage.setItem('village:seat:live', id), DEMO_USER_ID); });
test('authorized portraits share blob fetches; failed images retain initials; verify is multipart', async ({page}) => {
 const backend=new MockApi(), counts=new Map<string,number>(); let verified=false;
 await page.route('**/api/**',async route=>{
  const req=route.request(), u=new URL(req.url());
  if (!u.pathname.startsWith('/api/')) return route.continue();
  const path=u.pathname.slice(4)+u.search;
  if(path.endsWith('/presence/stream')) return route.fulfill({contentType:'text/event-stream',body:'event: presence\ndata: {"online":[]}\n\n'});
  if(path.startsWith('/assets/portrait-')) {
   expect(req.headers()['x-demo-user']).toBe(DEMO_USER_ID);
   counts.set(path,(counts.get(path)??0)+1);
   if(u.pathname.endsWith('2.svg')) return route.fulfill({status:404,json:{detail:'Missing'}});
   return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#d88354"/><circle cx="32" cy="26" r="14" fill="#ffe5cb"/><path d="M10 64 Q32 22 54 64" fill="#415b35"/></svg>'});
  }
  if(path==='/auth/face-verify') {
   expect(req.headers()['content-type']).toContain('multipart/form-data');
   expect(req.postDataBuffer()?.toString()).toContain('name="file"'); verified=true;
   return route.fulfill({json:{match:true,face_found:true}});
  }
  const result=await backend.request<any>(req.method(),path,DEMO_USER_ID, req.postData()?req.postDataJSON():undefined);
  const decorate=(p:any)=>{p.avatar.portrait={kind:'photo',asset_url:`/api/assets/portrait-${p.house_slot}.svg`};};
  result.villagers?.forEach(decorate); if(result.villager) decorate(result.villager);
  await route.fulfill({json:result});
 });
 await page.goto('/');
 await expect(page.locator('.villager-label .portrait img')).toHaveCount(4);
 await expect.poll(()=>page.locator('.villager-label .portrait img').evaluateAll(imgs=>imgs.every(i=>(i as HTMLImageElement).naturalWidth===64))).toBe(true);
 await page.getByRole('button',{name:'Inbox',exact:true}).click();
 await expect(page.locator('nav[aria-label="Conversations"] .portrait img')).toHaveCount(3);
 expect([...counts.values()]).toEqual([1,1,1,1,1]);
 await page.getByRole('button',{name:'Close dialog'}).click();
 await page.getByRole('button',{name:'Open Settings',exact:true}).click(); await page.getByRole('button',{name:'Refresh my face check',exact:true}).click();
 await page.getByLabel('Upload a selfie').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from('synthetic')});
 await expect(page.getByRole('dialog')).toContainText('Welcome back'); expect(verified).toBe(true);
});
