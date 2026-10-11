import { test, expect, type Page } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat();
async function avatar(page: Page) {
 await page.goto('/');
 await page.getByRole('button',{name:'My profile',exact:true}).click();
 await page.getByRole('tab',{name:'Outfit',exact:true}).click();
 await page.getByRole('button',{name:'Customize my avatar',exact:true}).click();
 await page.getByRole('button',{name:'Take a photo',exact:true}).click();
 return page.getByRole('dialog',{name:'Capture your avatar'});
}
test('fake camera, switch, countdown, retake, single photo, offline preset',async ({page}, info) => {
 const sheet = await avatar(page);
 await sheet.getByRole('button',{name:'Open camera',exact:true}).click();
 await expect(sheet.getByRole('button',{name:'Take photo',exact:true})).toBeEnabled();
 await sheet.getByRole('button',{name:'Switch camera'}).click();
 await expect(sheet.locator('video')).not.toHaveClass('mirrored');
 await sheet.getByRole('button',{name:'Switch camera'}).click();
 await expect(sheet.locator('video')).toHaveClass('mirrored');
 await expect(sheet.getByRole('button',{name:'Take photo',exact:true})).toBeEnabled();
 await sheet.evaluate(el => el.scrollTop = 0);
 await page.screenshot({path:`test-results/web027/${info.project.name}-camera.png`});
 await page.evaluate(() => {
  const draw = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (...args: any[]) {
   if (args[0] instanceof HTMLVideoElement) (window as any).captureTransform = Array.from(this.getTransform().toFloat64Array());
   return (draw as any).apply(this, args);
  };
 });
 await sheet.getByRole('button',{name:'Take photo',exact:true}).click();
 await expect(sheet.getByRole('status')).toHaveText('3');
 await expect(sheet.getByAltText('Photo to confirm')).toBeVisible({timeout:30000});
 expect(await page.evaluate(() => (window as any).captureTransform)).toEqual([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 await sheet.getByRole('button',{name:'Retake',exact:true}).click();
 await sheet.getByRole('button',{name:'Open camera',exact:true}).click();
 await sheet.getByRole('button',{name:'Take photo',exact:true}).click();
 await expect(sheet.getByAltText('Photo to confirm')).toBeVisible({timeout:30000});
 await page.screenshot({path:`test-results/web027/${info.project.name}-confirm.png`});
 await sheet.getByRole('button',{name:'Confirm photo'}).click();
 await expect(sheet).toHaveCount(0);
 await expect(page.getByText('Selected: photo.jpg')).toBeVisible();
 await expect(page.getByRole('button',{name:'Build my avatar',exact:true})).toBeDisabled();
 await page.evaluate(async () => {
  const path = '/src/api/client.ts'; const {api} = await import(path);
  const request = api.request.bind(api);
  api.request = (method: string, path: string, body?: unknown) => {
   if (path.endsWith('/photo') && body instanceof FormData) (window as any).photoFields = [...body.keys()];
   return request(method, path, body);
  };
 });
 await page.getByLabel('my photo and voice may be used').check();
 await page.getByRole('button',{name:'Build my avatar',exact:true}).click();
 await expect(page.getByText('The GPU worker is offline in demo mode. Your preset avatar is still available.')).toBeVisible();
 expect(await page.evaluate(() => (window as any).photoFields)).toEqual(['file','consent']);
});
test('denied camera supports single upload and Make it real',async ({page}) => {
 const sheet = await avatar(page);
 await page.evaluate(() => {navigator.mediaDevices.getUserMedia = async () => {throw new DOMException('Denied','NotAllowedError');};});
 await sheet.getByRole('button',{name:'Open camera',exact:true}).click();
 await expect(sheet.getByRole('alert')).toContainText('Upload a photo instead');
 await sheet.getByLabel('Upload capture photo').setInputFiles({name:'front.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6X2sAAAAASUVORK5CYII=','base64')});
 await sheet.getByRole('button',{name:'Confirm photo'}).click();
 await expect(page.getByText('Selected: front.png')).toBeVisible();
 await page.getByRole('button',{name:'Make it real',exact:true}).click();
 const item=page.getByRole('dialog',{name:'Make it real',exact:true});
 await item.getByRole('button',{name:'Take a photo',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Take a photo',exact:true})).toBeVisible();
});
test('camera tracks stop on closing during countdown',async ({page}) => {
 const sheet=await avatar(page);
 await sheet.getByRole('button',{name:'Open camera',exact:true}).click();
 await expect(sheet.getByRole('button',{name:'Take photo',exact:true})).toBeEnabled();
 await sheet.locator('video').evaluate(el => {(window as any).captureTracks=((el as HTMLVideoElement).srcObject as MediaStream).getTracks();});
 await sheet.getByRole('button',{name:'Take photo',exact:true}).click();
 await sheet.getByRole('button',{name:'Close dialog'}).click();
 await expect.poll(()=>page.evaluate(()=>(window as any).captureTracks.every((t: MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
});

test('group camera preserves consent before upload', async ({page}) => {
 await page.goto('/');
 await page.getByRole('button',{name:'Village',exact:true}).click();
 await page.getByRole('button',{name:'Our group photo',exact:true}).click();
 const group=page.getByRole('dialog',{name:'Our group photo',exact:true});
 await group.getByRole('button',{name:'Take a photo',exact:true}).click();
 const sheet=page.getByRole('dialog',{name:'Take a photo',exact:true});
 await sheet.getByRole('button',{name:'Open camera',exact:true}).click();
 await sheet.getByRole('button',{name:'Take photo',exact:true}).click();
 await expect(sheet.getByAltText('Photo to confirm')).toBeVisible({timeout:30000});
 await sheet.getByRole('button',{name:'Confirm photo'}).click();
 await expect(group.getByText('Selected: photo.jpg')).toBeVisible();
 await expect(group.getByRole('button',{name:'Find our people'})).toBeDisabled();
 await group.getByRole('checkbox',{name:/Everyone in this group/}).check();
 await group.getByRole('button',{name:'Find our people'}).click();
 await expect(group.getByRole('img',{name:'Shared group photo'})).toBeVisible();
});
