import {useDemoSeat} from './demoSeat';
useDemoSeat();
import { expect, test } from '@playwright/test';

test('prayer is pinned, truthful, dismissible and survives reload; journal is ordered and collapsed', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    // Audio assets load independently of the village; wait before asserting playback.
    // @ts-expect-error Vite runtime import
    const { sound } = await import('/src/sound/engine.ts');
    await sound.init();
    // @ts-expect-error Vite runtime import
    const { api } = await import('/src/api/client.ts');
    const village = api.village.bind(api);
    api.village = async (id: string) => ({ ...await village(id), active_events: Array.from({ length: 7 }, (_, i) => ({ id: `event-${i}`, kind: i === 6 ? 'prayer_response' : 'challenge', title: `Event ${i}`, body: 'Small steps together.', reward_xp: i === 6 ? 0 : 25, status: i === 5 ? 'failed' : i === 4 ? 'completed' : 'active', penalty: null, ends_at: null, created_at: `2026-10-0${i + 1}T12:00:00Z` })) });
    api.pray = async () => ({ id: 'answer', kind: 'prayer_response', title: 'A breath before the finish', body: 'Take one small step together. Your village is cheering you on.', reward_xp: 0, status: 'active', penalty: null, ends_at: null, model: 'test-provider/encouragement-v2' });
    const play = HTMLMediaElement.prototype.play;
    (window as any).chimes = 0;
    HTMLMediaElement.prototype.play = function () { if (this.src.endsWith('/sfx/prayer_chime.mp3')) (window as any).chimes++; return play.call(this); };
  });
  await page.getByRole('button', { name: 'Mayor', exact: true }).click();
  await page.getByRole('button', {name:/Make a prayer/}).click();
  await page.getByLabel('Pray to the Mayor').fill('Help us finish the week.');
  await page.getByRole('button', { name: 'Send wish' }).click();
  const answer = page.getByRole('status', { name: "Mayor's answer" });
  await expect(answer).toContainText('AI · test-provider/encouragement-v2');
  await expect(answer).not.toContainText('+0 XP');
  await expect.poll(() => page.evaluate(() => (window as any).chimes)).toBe(1);
  const events = page.getByRole('region', { name: 'Mayor events' }).locator('article');
  await expect(events).toHaveCount(3);
  await expect(events.locator('h3')).toHaveText(['Event 6', 'Event 5', 'Event 4']);
  await expect(events.first()).toHaveClass(/event-prayer_response/);
  await expect(events.nth(1)).toHaveClass(/event-muted/);
  await expect(events.nth(2)).toHaveClass(/event-muted/);
  await page.getByRole('button', { name: 'Show 4 more' }).click();
  await expect(events).toHaveCount(7);
  await page.getByRole('dialog').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(answer).toBeInViewport();
  await page.getByRole('dialog').evaluate(el => { el.scrollTop = 0; });
  await page.screenshot({ path: 'test-results/web007-prayer-card.png' });
  await page.reload();
  await page.getByRole('button', { name: 'Mayor', exact: true }).click();
  await page.getByRole('button', {name:/Make a prayer/}).click();
  await expect(answer).toContainText('A breath before the finish');
  await page.getByRole('button', { name: "Dismiss Mayor's answer" }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Mayor', exact: true }).click();
  await page.getByRole('button', {name:/Make a prayer/}).click();
  await expect(answer).toHaveCount(0);
  await page.getByLabel('Pray to the Mayor').fill('Another wish');
  await page.getByRole('button', { name: 'Send wish' }).click();
  await expect(answer).toContainText('AI · scripted-demo');
});

test('legacy Mayor response keeps server ordering and never invents model provenance', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    // @ts-expect-error Vite runtime import
    const { api } = await import('/src/api/client.ts');
    const village = api.village.bind(api);
    const event = { id: 'reward', kind: 'challenge', title: 'A walk together', body: 'Invite a neighbor for a short walk.', reward_xp: 50, status: 'active', penalty: null, ends_at: null };
    api.pray = async () => event;
    api.village = async (id: string) => ({ ...await village(id), active_events: [event, { ...event, id: 'latest', title: 'Latest event' }, { ...event, id: 'older', title: 'Older event' }] });
  });
  await page.getByRole('button', { name: 'Mayor', exact: true }).click();
  await page.getByRole('button', {name:/Make a prayer/}).click();
  await page.getByLabel('Pray to the Mayor').fill('A challenge for us');
  await page.getByRole('button', { name: 'Send wish' }).click();
  const answer = page.getByRole('status', { name: "Mayor's answer" });
  await expect(answer).toContainText('AI · Model not supplied');
  await expect(answer).toContainText('+50 XP');
  await expect(answer).toContainText('Village challenge');
  await expect(page.getByRole('region', { name: 'Mayor events' }).locator('h3')).toHaveText(['Village journal', 'Latest event', 'Older event']);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(answer).toBeInViewport();
  await page.getByRole('button', { name: "Dismiss Mayor's answer" }).click();
  await expect(answer).toHaveCount(0);
});

test('pending competition entries and status are visible before evidence and submission controls', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    // @ts-expect-error Vite runtime import
    const { api } = await import('/src/api/client.ts');
    const competition = { id: 'study', title: 'Study streak', terms: 'One point per study session with notes.', friendly: false, auditor_id: '00000000-0000-4000-8000-000000000004', creator_id: api.user, entry_lamports: 0, status: 'open', result: null };
    api.competitions = async () => [competition];
    api.competition = async () => ({ ...competition, participants: [{ user_id: api.user, entry_lamports: 0 }], entries: ['confirmed', 'pending', 'rejected'].map((decision, i) => ({ id: `entry-${i}`, user_id: api.user, body: decision === 'pending' ? 'New study notes awaiting review.' : 'Previous study session.', decision, points: i === 0 ? 1 : 0, evidence_asset_id: null, review: null, reason: null, idempotency_key: `key-${i}` })) });
  });
  await page.getByRole('button', { name: 'Compete', exact: true }).click();
  await page.getByRole('button', { name: /Study streak/ }).click();
  await page.getByRole('button', {name:'Submit / manage competition'}).click();
  const entries = page.getByRole('article', { name: 'Entry by Iraj' });
  await expect(entries.first()).toContainText('New study notes awaiting review.');
  await entries.first().scrollIntoViewIfNeeded();
  await expect(entries.first().getByText('pending', { exact: true })).toBeInViewport();
  await expect(entries.locator('.entry-status')).toHaveText(['pending', 'confirmed', 'rejected']);
  const form = await page.getByLabel('Entry description').boundingBox();
  const first = await entries.first().boundingBox();
  expect(first!.y).toBeLessThan(form!.y);
  await page.screenshot({ path: 'test-results/web007-compete-list.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await entries.first().scrollIntoViewIfNeeded();
  await expect(entries.first().getByText('pending', { exact: true })).toBeInViewport();
});

for (const expression of [false, true]) test(`mock LAM uses approximate motion with expression fixture available=${expression} and clears after playback`, async ({ page }) => {
  // Synthetic renderer and PCM tone: no generated assets or provider requests.
  await page.route('**/src/components/lamRuntime.ts', route => route.fulfill({ contentType: 'application/javascript', body: 'export function scheduleHead(host, options, ready) { ready({setAudio(){},setExpr(){},dispose(){}}); return () => {}; }' }));
  const samples = 8000 * 3, wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(Math.sin(i / 8000 * Math.PI * 440) * 2000), 44 + i * 2);
  await page.route('**/api/assets/test/head.zip*', route => route.fulfill({status:404,body:'Synthetic head handled by runtime stub'}));
  await page.route('**/synthetic-voice.wav', route => route.fulfill({ contentType: 'audio/wav', body: wav }));
  await page.route('**/api/assets/test/expr.json', route => expression ? route.fulfill({ json: { names: ['jawOpen'], frames: [{ weights: [0.2] }] } }) : route.fulfill({ status: 404 }));
  await page.goto('/');
  await page.evaluate(async () => {
    // @ts-expect-error Vite runtime import
    const { api } = await import('/src/api/client.ts');
    const profile = api.profile.bind(api);
    api.profile = async (...args: unknown[]) => { const p = await profile(...args); p.villager.avatar.portrait = { kind: 'lam_head', head_package_url: '/api/assets/test/head.zip' }; return p; };
    api.voice = async () => ({ id: 'synthetic', audio_url: '/synthetic-voice.wav', expr_url: '/api/assets/test/expr.json' });
  });
  await page.getByRole('button', { name: 'My profile' }).click();
  await expect(page.locator('[data-head-state="ready"]')).toBeVisible();
  await page.getByRole('button', { name: 'Hear them' }).click();
  const hint = page.getByText('lip-sync: approximate', { exact: true });
  await expect(hint).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hear them' })).toBeEnabled();
  await expect(hint).toHaveCount(0);
});

test('POLISH-001 HUD shortcuts, badges and focus restore without intercepting typing', async ({ page }) => {
  await page.goto('/');
  const review = page.getByRole('button', {name:'Weekly review', exact:true});
  await expect(review.locator('.hud-badge')).toHaveText('4');
  await review.focus();
  await expect(review).toHaveAttribute('title', 'Weekly review - Alt+W');
  await review.click();
  await expect(review).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(review).toBeFocused();
  await page.locator('body').click({position:{x:10,y:200}});
  await page.keyboard.press('Alt+c');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', {name:/Daily note/}).click();
  await page.locator('#checkin-body').fill('wpgims are just letters in my note');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.locator('#checkin-body')).toHaveValue('wpgims are just letters in my note');
});

test('POLISH-001 mobile actions and dialogs fit, reduced motion is respected', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  for (const name of ['Village','Check in','Weekly review','Compete','Shop','Mayor','My goal']) {
    const button = page.getByRole('button',{name,exact:true});
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport();
    const b = (await button.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x+b.width).toBeLessThanOrEqual(390);
  }
  await page.getByRole('button',{name:'Check in',exact:true}).last().click();
  await page.getByRole('button', {name:/Daily note/}).click();
  const dialog = page.getByRole('dialog');
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await dialog.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await expect(page.getByRole('button',{name:'Share check-in'})).toBeInViewport();
  await page.getByRole('button',{name:'Close dialog'}).click();
  await expect(dialog).toHaveCount(0);
});

test('POLISH-001 competition empty state, XP and level-up use fixture data', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Check in',exact:true}).last().waitFor();
  await page.evaluate(async () => {
    // @ts-expect-error Vite runtime import
    const {api} = await import('/src/api/client.ts');
    api.competitions = async () => { await new Promise(r => setTimeout(r,1500)); return []; };
    const checkIn = api.checkIn.bind(api);
    api.checkIn = async (...args: unknown[]) => ({...await checkIn(...args), xp_awarded:50});
  });
  await page.getByRole('button',{name:'Compete',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('No competitions yet');
  await page.getByRole('button',{name:'\u2190 Village',exact:true}).click();
  await page.getByRole('button',{name:'Check in',exact:true}).last().click();
  await page.getByRole('button', {name:/Daily note/}).click();
  await page.locator('#checkin-body').fill('A little progress today.');
  await page.getByRole('button',{name:'Share check-in'}).click();
  await expect(page.locator('.village-toast[data-kind=reward] strong')).toContainText('+50 coins');
  await expect(page.locator('.village-toast[data-kind=reward] strong')).toContainText('+50 XP');
  await expect(page.locator('.toast-moment')).toContainText('Level 4');
});
