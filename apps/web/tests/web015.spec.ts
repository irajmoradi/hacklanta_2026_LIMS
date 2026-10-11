import { test, expect } from '@playwright/test';
import {browserGpuArgs} from './browserGpu';
import { useDemoSeat } from './demoSeat';
useDemoSeat();
test.use({permissions:['camera'], launchOptions:{args:[...browserGpuArgs,'--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}});
async function enterFaceCheck(page: import('@playwright/test').Page) { await page.getByRole('button',{name:'Open Settings',exact:true}).click(); await page.getByRole('button',{name:'Refresh my face check',exact:true}).click(); }
async function open(page: import('@playwright/test').Page) { await page.goto('/'); await enterFaceCheck(page); }
const selfie = {name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from('synthetic')};
test('camera permission is explicit, capture succeeds and camera stops; refresh and Play as', async ({page}) => {
  await page.addInitScript(() => { const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); (window as any).streams=[]; navigator.mediaDevices.getUserMedia=async c => { const s=await get(c); (window as any).streams.push(s); return s; }; });
  await open(page);
  expect(await page.evaluate(() => (window as any).streams.length)).toBe(0);
  await page.getByRole('button',{name:'Open camera',exact:true}).click();
  await page.getByRole('dialog',{name:'Face-check selfie'}).getByRole('button',{name:'Open camera',exact:true}).click();
  await expect(page.getByRole('button',{name:'Take photo',exact:true})).toBeEnabled();
  await page.screenshot({path:'test-results/web015/face-camera.png'});
  await page.getByRole('button',{name:'Take photo',exact:true}).click();
  await page.getByRole('button',{name:'Confirm photo'}).click();
  await expect(page.getByRole('dialog')).toContainText('Welcome back');
  expect(await page.evaluate(() => (window as any).streams[0].getTracks().every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
  await page.screenshot({path:'test-results/web015/face-recognized.png'});
  await page.getByRole('button',{name:'Back to the village'}).click();
  await page.getByRole('button',{name:'My profile',exact:true}).click();
  await page.getByRole('button',{name:'Profile settings',exact:true}).click();
  await page.getByRole('button',{name:'Refresh my face check'}).click();
  await page.getByRole('button',{name:'Refresh from my avatar photo'}).click();
  await expect(page.getByRole('dialog')).toContainText('Now check your selfie');
  await page.getByRole('button',{name:'Open camera',exact:true}).click();
  await page.getByRole('dialog',{name:'Face-check selfie'}).getByRole('button',{name:'Open camera',exact:true}).click();
  await expect(page.getByRole('button',{name:'Take photo',exact:true})).toBeEnabled();
  await page.getByRole('dialog',{name:'Face-check selfie'}).getByRole('button',{name:'Close dialog'}).click();
  await page.getByRole('button',{name:'Skip for now'}).click();
  await expect(page.locator('.face-check')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).streams.every((s:MediaStream)=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
  await expect(page.locator('.profile-panel')).toHaveCount(1);
  await page.getByRole('button',{name:'Close profile'}).click();
  await page.getByLabel('Play as').selectOption({index:1});
  await enterFaceCheck(page);
  await expect(page.getByRole('dialog')).toContainText('Lance');
});
test('mock failure outcomes, retry and upload fallback', async ({page}) => {
  await open(page);
  for (const [outcome,message] of [['mismatch',"doesn't look like"],['no-face','No face found'],['offline','taking a break'],['limited','Five tries']]) {
    await page.getByLabel('Demo result').selectOption(outcome);
    await page.getByLabel('Upload a selfie').setInputFiles(selfie);
    await expect(page.getByRole('dialog')).toContainText(message);
  }
  await page.getByLabel('Demo result').selectOption('match');
  await page.getByLabel('Upload a selfie').setInputFiles(selfie);
  await expect(page.getByRole('dialog')).toContainText('Welcome back');
});
test('denied camera falls back to upload', async ({page}) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => {throw new DOMException('Denied','NotAllowedError');}; });
  await open(page); await page.getByRole('button',{name:'Open camera',exact:true}).click();
  await page.getByRole('dialog',{name:'Face-check selfie'}).getByRole('button',{name:'Open camera',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Face-check selfie'})).toContainText('Upload a photo instead');
  await page.getByRole('dialog',{name:'Face-check selfie'}).getByRole('button',{name:'Close dialog'}).click();
  await page.getByLabel('Upload a selfie').setInputFiles(selfie);
  await expect(page.getByRole('dialog')).toContainText('Welcome back');
});
test('portraits populate scene, phone people and inbox; dashboard activity remains available', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('.villager-label .portrait')).toHaveCount(5);
  await expect(page.locator('.neighbors-strip .portrait')).toHaveCount(5);
  expect(await page.locator('.activity-feed .portrait').count()).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Inbox',exact:true}).click();
  await expect(page.locator('nav[aria-label="Conversations"] .portrait')).toHaveCount(4);
  await page.getByRole('button',{name:'Close dialog'}).click();
  await page.setViewportSize({width:390,height:844});
  await page.locator('.neighbors-strip button').first().click();
  await expect(page.locator('.profile-name h2')).toBeVisible();
});

test('skipping releases a permission grant arriving after close', async ({page}) => {
  await page.addInitScript(() => {
    (window as any).stops = 0;
    navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { (window as any).grant = () => resolve({getTracks:()=>[{stop:()=>{(window as any).stops++;}}]} as unknown as MediaStream); });
  });
  await open(page); await page.getByRole('button',{name:'Open camera',exact:true}).click();
  await page.getByRole('dialog',{name:'Face-check selfie'}).getByRole('button',{name:'Open camera',exact:true}).click();
  await page.getByRole('dialog',{name:'Face-check selfie'}).getByRole('button',{name:'Close dialog'}).click();
  await page.getByRole('button',{name:'Skip for now'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() => (window as any).grant());
  await expect.poll(()=>page.evaluate(()=>(window as any).stops)).toBe(1);
});

test('badge toast appears once per browser identity across reload', async ({page}) => {
  await open(page);
  await page.getByLabel('Upload a selfie').setInputFiles(selfie);
  await expect(page.locator('.village-toast')).toContainText('Recognized by the village');
  await page.reload();
  await enterFaceCheck(page);
  await page.getByLabel('Upload a selfie').setInputFiles(selfie);
  await expect(page.getByRole('dialog')).toContainText('Welcome back');
  await expect(page.locator('.village-toast')).toHaveCount(0);
});
