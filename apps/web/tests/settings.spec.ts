import {browserGpuArgs} from './browserGpu';
import { expect, test } from '@playwright/test';
import { MockApi } from '../src/api/mock';
import { DEMO_USER_ID } from '../src/api/fixtures';

test.beforeEach(async ({page}) => { await page.addInitScript((id) => {localStorage.setItem('village:seat:live', id); localStorage.setItem(`village:guide:v1:${id}`, 'seen');}, DEMO_USER_ID); });

test.use({launchOptions: {args: [...browserGpuArgs, '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']}});

test('native recording collects a memo and stops the microphone on mobile close', async ({page, context}) => {
  const backend = new MockApi();
  await context.grantPermissions(['microphone']); await page.setViewportSize({width:390,height:844});
  await page.addInitScript(() => {
    const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async options => { const stream = await get(options); (window as any).memoStream = stream; return stream; };
  });
  await page.route(url => url.pathname.startsWith('/api/'), async route => { const req = route.request(), url = new URL(req.url()); await route.fulfill({json: await backend.request(req.method(), url.pathname.slice(4)+url.search, DEMO_USER_ID, req.postData() ? req.postDataJSON() : undefined)}); });
  await page.goto('/'); await page.getByRole('button',{name:'My profile'}).click(); await page.getByRole('button',{name:'Profile settings',exact:true}).click();
  await page.getByRole('button',{name:'Record a memo'}).click(); await expect(page.getByText('Recording… microphone is on.')).toBeVisible();
  await page.waitForTimeout(1200); await page.getByRole('button',{name:'Stop recording'}).click();
  await expect(page.getByRole('button',{name:'Remove memo 1'})).toBeVisible(); await expect(page.getByRole('button',{name:'Create my voice'})).toBeDisabled();
  await expect.poll(() => page.evaluate(() => (window as any).memoStream.getTracks().every((t: MediaStreamTrack) => t.readyState === 'ended'))).toBe(true);
  await page.getByRole('button',{name:'Record a memo'}).click(); await expect(page.getByRole('button',{name:'Stop recording'})).toBeVisible();
  await page.getByRole('button',{name:'Close dialog'}).click();
  await expect.poll(() => page.evaluate(() => (window as any).memoStream.getTracks().every((t: MediaStreamTrack) => t.readyState === 'ended'))).toBe(true);
});

test('settings PATCH, voice consent gating, failed deletion and retry', async ({page}) => {
  const backend = new MockApi(); let patch: any, clones = 0, deletes = 0;
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.slice(4) + url.search;
    if (path === '/me/voice') {
      if (req.method() === 'POST') { clones++; expect(req.postDataBuffer()!.toString()).toContain('name="consent"\r\n\r\ntrue'); return route.fulfill({json: {voice_id: 'synthetic', voice_consent: true, voice_consent_version: 'village-voice-v1', voice_consent_at: new Date().toISOString()}}); }
      if (++deletes === 1) return route.fulfill({status: 502, json: {detail: 'Provider unavailable'}});
      return route.fulfill({json: {voice_id: null, voice_consent: false, voice_consent_version: null, voice_consent_at: null}});
    }
    if (req.method() === 'PATCH') patch = req.postDataJSON();
    const data = req.postData() ? req.postDataJSON() : undefined;
    await route.fulfill({json: await backend.request(req.method(), path, DEMO_USER_ID, data)});
  });
  await page.goto('/'); await page.getByRole('button', {name: 'My profile'}).click(); await page.getByRole('button', {name: 'Profile settings', exact: true}).click();
  await page.getByLabel('Display name', {exact: true}).fill('Iraj updated'); await page.getByLabel('Phone (E.164)').fill('+15551234567');
  await page.getByLabel('Roast me', {exact: true}).check(); await page.getByLabel('Mayor may text me', {exact: true}).check();
  await page.getByRole('button', {name: 'Save settings'}).click(); await expect(page.getByText('Settings saved.', {exact:true})).toBeVisible();
  expect(patch).toEqual({idle_activity: 'home', display_name: 'Iraj updated', phone_e164: '+15551234567', roast_ok: true, agent_msgs_ok: true, allow_voice_by_friends: false, receive_villagergrams: false});
  await page.getByLabel('Upload voice memos').setInputFiles({name:'memo.wav', mimeType:'audio/wav', buffer:Buffer.from('synthetic test audio')});
  const create = page.getByRole('button', {name: 'Create my voice'}); await expect(create).toBeDisabled(); expect(clones).toBe(0);
  await expect(page.getByText('Consent text version: village-voice-v1')).toBeVisible();
  await page.getByRole('checkbox', {name: /I confirm these recordings/}).check(); await create.click();
  await expect(page.getByRole('button', {name: 'Delete my voice'})).toBeVisible(); expect(clones).toBe(1);
  await page.getByRole('button', {name: 'Delete my voice'}).click(); await expect(page.getByRole('alert')).toContainText('Provider unavailable');
  await expect(page.getByText('Voice ready. AI-generated voice.', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Delete my voice'}).click(); await expect(page.getByText('No voice clone yet.')).toBeVisible();
  await expect(page.getByRole('checkbox', {name: /I confirm these recordings/})).not.toBeChecked();
});

test('private evidence lightbox shows suspicious verdict and revokes its blob on close profile', async ({page}) => {
  const backend = new MockApi(); let assets = 0;
  await page.addInitScript(() => { const revoke = URL.revokeObjectURL.bind(URL); (window as any).revoked = []; URL.revokeObjectURL = url => { (window as any).revoked.push(url); revoke(url); }; });
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.slice(4) + url.search;
    if (path.endsWith('/review')) return route.fulfill({json: {verdict:'suspicious', confidence:.9, reason:'Repeated workout screenshot.', model:'demo-fixture/not-called'}});
    if (path === '/assets/evidence/test.svg') { assets++; expect(req.headers()['x-demo-user']).toBe(DEMO_USER_ID); return route.fulfill({contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="tan"/><text x="20" y="80">Synthetic workout evidence</text></svg>'}); }
    const result = await backend.request<any>(req.method(), path, DEMO_USER_ID, req.postData() ? req.postDataJSON() : undefined);
    if (result.check_ins?.length) Object.assign(result.check_ins[0], {evidence_url:'/api/assets/evidence/test.svg', review:{verdict:'suspicious', confidence:.9, reason:'Repeated workout screenshot.'}});
    await route.fulfill({json:result});
  });
  await page.goto('/'); await page.getByRole('button', {name:'Visit Lance',exact:true}).click(); await page.getByRole('button', {name:'View evidence',exact:true}).click();
  const dialog = page.getByRole('dialog', {name:'Evidence review'}); await expect(dialog.getByText('AI verdict: suspicious')).toBeVisible();
  await expect(dialog.getByText('Repeated workout screenshot.')).toBeVisible(); await expect(dialog.getByText(/Model: demo-fixture/)).toBeVisible();
  const src = await dialog.getByAltText('Full check-in evidence').getAttribute('src'); expect(src).toMatch(/^blob:/); expect(assets).toBe(1);
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await page.getByRole('button', {name:'Close profile'}).click();
  await expect.poll(() => page.evaluate((source) => (window as any).revoked.includes(source), src)).toBe(true);
});

test('village switch survives reload and nine tour steps remain operable', async ({page}) => {
  const backend = new MockApi(); const created = await backend.request<any>('POST','/villages',DEMO_USER_ID,{name:'Second village'});
  await page.route(url => url.pathname.startsWith('/api/'), async route => { const req = route.request(), url = new URL(req.url()); await route.fulfill({json: await backend.request(req.method(), url.pathname.slice(4)+url.search, DEMO_USER_ID, req.postData() ? req.postDataJSON() : undefined)}); });
  await page.goto('/'); await page.getByRole('combobox', {name:'Village',exact:true}).selectOption(created.village.id); await expect(page.getByRole('combobox', {name:'Village',exact:true})).toHaveValue(created.village.id);
  await page.reload(); await expect(page.getByRole('combobox', {name:'Village',exact:true})).toHaveValue(created.village.id);
  await page.goto('/?tour=1');
  for (let i=0; i<9; i++) { const guide = page.getByRole('region',{name:'Village tour'}); await expect(guide).toContainText(`${i+1} / 9`); await guide.getByRole('button',{name:i===8?'Finish':'Next',exact:true}).click(); }
  await expect(page.getByRole('region',{name:'Village tour'})).toHaveCount(0);
});
