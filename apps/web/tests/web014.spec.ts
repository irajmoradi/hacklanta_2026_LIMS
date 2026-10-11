import { test, expect } from '@playwright/test';
import { MockApi } from '../src/api/mock';
import { DEMO_USER_ID, DEMO_VILLAGE_ID, makeFixtures } from '../src/api/fixtures';
const peer = makeFixtures().village.villagers.find(v => v.user_id !== DEMO_USER_ID)!;
let api: MockApi;
let requests: {path:string; body:Record<string,unknown> | null}[];
test.beforeEach(async ({page}) => {
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  api = new MockApi(); requests = [];
  await page.route('**/api/**', async route => {
    const r = route.request(), url = new URL(r.url());
    if (!url.pathname.startsWith('/api/')) { await route.continue(); return; }
    const path = url.pathname.slice(4) + url.search;
    if (path.endsWith('/presence/stream')) { await route.fulfill({contentType:'text/event-stream',body:`event: presence\ndata: ${JSON.stringify({online:[{user_id:peer.user_id,x:1,z:2,activity:'visiting'}]})}\n\n`}); return; }
    requests.push({path,body:r.postDataJSON()});
    try {await route.fulfill({json:await api.request(r.method(),path,r.headers()['x-demo-user'] ?? DEMO_USER_ID,r.postDataJSON() ?? undefined)});}
    catch(e) {await route.fulfill({status:(e as {status?:number}).status ?? 500,json:{detail:String(e)}});}
  });
  await page.route('**/models/**', r => r.fulfill({status:404,body:'Offline'}));
});
test('inbox unread, safe conversation, compose, poke and cheer feed', async ({page}) => {
  await api.request('POST',`/villages/${DEMO_VILLAGE_ID}/messages`,peer.user_id,{to_user_id:DEMO_USER_ID,text:'<b>See you at game night</b>'});
  await page.goto('/', {waitUntil:'domcontentloaded'}); await page.getByRole('button',{name:'Inbox 1'}).click();
  await page.getByRole('navigation',{name:'Conversations'}).getByRole('button',{name:peer.display_name}).click();
  await expect(page.getByText('<b>See you at game night</b>',{exact:true})).toBeVisible();
  await page.getByLabel('Your message').fill('Count me in!'); await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect(page.getByText('Count me in!',{exact:true})).toBeVisible();
  await page.screenshot({path:'tests/artifacts/web014-inbox-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.screenshot({path:'tests/artifacts/web014-inbox-mobile.png'});
  await page.getByRole('button',{name:'Close dialog'}).click();
  await page.setViewportSize({width:1280,height:900});
  await expect(page.getByRole('button',{name:'Inbox',exact:true})).toBeVisible();
  await page.getByRole('button',{name:`Visit ${peer.display_name}`,exact:true}).click();
  await page.getByRole('button',{name:/Poke/}).click(); await expect(page.getByText('Poke sent!',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Cheer/}).click(); await expect(page.getByText('Cheer sent!',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close profile'}).click();
  await expect(page.getByRole('region',{name:'Village feed'}).getByText(/poked/)).toBeVisible();
  await expect(page.getByRole('region',{name:'Village feed'}).getByText(/cheered/)).toBeVisible();
});
test('presence activity and bribe receipt debit', async ({page}) => {
  await page.goto('/', {waitUntil:'domcontentloaded'}); await expect(page.getByRole('img',{name:'Online now'}).first()).toBeVisible();
  await page.getByRole('button',{name:'Shop',exact:true}).click();
  await expect.poll(()=>requests.some(r=>r.path.endsWith('/presence/heartbeat') && r.body?.activity==='shopping')).toBe(true);
  await page.getByRole('button',{name:'Close dialog'}).click();
  await page.getByRole('button',{name:'Mayor',exact:true}).click();
  await page.getByLabel('Your wish').fill('A game night for everyone'); await page.getByRole('button',{name:'Offer coins',exact:true}).click();
  await expect(page.getByText('The Mayor pockets 50 coins and winks.',{exact:true})).toBeVisible();
  await expect(page.getByText(/pending.*50 coins/)).toBeVisible();
  expect(requests.filter(r=>r.path.endsWith('/mayor/bribe'))).toHaveLength(1);
  await page.locator('.bribe-receipt').scrollIntoViewIfNeeded();
  await page.screenshot({path:'tests/artifacts/web014-bribe.png'});
});
test('sound preferences persist and deletion needs typed confirmation', async ({page}) => {
  await page.goto('/', {waitUntil:'domcontentloaded'}); await page.getByRole('button',{name:'Mute sound',exact:true}).click();
  await page.reload({waitUntil:'domcontentloaded'}); await expect(page.getByRole('button',{name:'Unmute sound',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'My profile',exact:true}).click(); await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByLabel('Reduced sound',{exact:true}).check();
  const deletion=page.getByRole('button',{name:'Delete my account',exact:true}); await expect(deletion).toBeDisabled();
  await page.getByLabel('Type DELETE to confirm').fill('delete'); await expect(deletion).toBeDisabled();
  await page.getByLabel('Type DELETE to confirm').fill('DELETE'); await deletion.click();
  await expect(page.getByRole('heading',{name:'Your account has been deleted.'})).toBeVisible();
  await expect(page.getByText('You are signed out of Village.')).toBeVisible();
});
test('deletion failure stays in settings and displays server error', async ({page}) => {
  await page.route('**/api/me',async route => {if(route.request().method()==='DELETE') await route.fulfill({status:409,json:{detail:'A GPU job is still running.'}}); else await route.fallback();});
  await page.goto('/', {waitUntil:'domcontentloaded'}); await page.getByRole('button',{name:'My profile',exact:true}).click(); await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByLabel('Type DELETE to confirm').fill('DELETE'); await page.getByRole('button',{name:'Delete my account',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('A GPU job is still running.'); await expect(page.getByRole('dialog')).toBeVisible();
});

test('forced offline social flows need no API or GPU', async ({page}) => {
  await page.route('**/api/**', async route => {if(new URL(route.request().url()).pathname.startsWith('/api/')) await route.abort(); else await route.continue();});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:`Visit ${peer.display_name}`,exact:true}).click();
  await page.getByRole('button',{name:'Message',exact:true}).click();
  await page.getByLabel('Your message').fill('Hello offline neighbor'); await page.getByRole('button',{name:'Send message',exact:true}).click();
  await expect(page.getByText('Hello offline neighbor',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close dialog'}).click(); await page.getByRole('button',{name:'Close profile'}).click();
  await page.getByLabel('Play as').selectOption(peer.user_id); await page.getByRole('button',{name:'Inbox 1'}).click();
  await page.getByRole('navigation',{name:'Conversations'}).getByRole('button',{name:'Iraj'}).click();
  await expect(page.getByText('Hello offline neighbor',{exact:true})).toBeVisible(); await page.getByRole('button',{name:'Close dialog'}).click();
  await page.getByRole('button',{name:'Mayor',exact:true}).click(); await page.getByLabel('Your wish').fill('An offline picnic'); await page.getByRole('button',{name:'Offer coins',exact:true}).click();
  await expect(page.getByText('The Mayor pockets 50 coins and winks.',{exact:true})).toBeVisible(); await page.getByRole('button',{name:'Close dialog'}).click();
  await page.getByRole('button',{name:'My profile',exact:true}).click(); await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByLabel('Type DELETE to confirm').fill('DELETE'); await page.getByRole('button',{name:'Delete my account',exact:true}).click();
  await expect(page.getByText('You are signed out of Village.')).toBeVisible();
});
test('sound pack stays silent before gesture and mute blocks poke effects', async ({page}) => {
  await page.addInitScript(() => {
    const calls: string[] = []; (window as unknown as {soundCalls:string[]}).soundCalls=calls;
    window.Audio = class {src:string; volume=0; currentTime=0; preload=''; loop=false; constructor(src=''){this.src=src;} play(){calls.push(this.src);return Promise.resolve();} pause(){} } as unknown as typeof Audio;
  });
  await page.goto('/',{waitUntil:'domcontentloaded'}); await expect(page.getByRole('button',{name:'Inbox',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {soundCalls:string[]}).soundCalls)).toEqual([]);
  await page.getByRole('button',{name:`Visit ${peer.display_name}`,exact:true}).click(); await page.getByRole('button',{name:/Poke/}).click();
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {soundCalls:string[]}).soundCalls.includes('/sfx/poke_boing.mp3'))).toBe(true);
  await page.getByRole('button',{name:'Mute sound',exact:true}).click();
  const count = await page.evaluate(()=>(window as unknown as {soundCalls:string[]}).soundCalls.length);
  await page.getByRole('button',{name:/Poke/}).click(); await expect(page.getByText('Poke sent!',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as unknown as {soundCalls:string[]}).soundCalls.length)).toBe(count);
});
