import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';

test('two seats see movement, stop, emote and reconnect on scratch API', async ({browser}, info) => {
  const started = Date.now();
  let clipStart = 0;
  const contexts = await Promise.all([1,2].map(async seat => {
    const context = await browser.newContext({baseURL:info.project.use.baseURL,viewport:{width:1000,height:800},recordVideo:{dir:info.outputPath(`seat-${seat}`),size:{width:1000,height:800}}});
    await context.addInitScript(seat => {
      const uid=`13370000-0000-4000-8000-00000000000${seat}`;
      localStorage.setItem('village:seat:live',uid);
      localStorage.setItem(`village:last:${uid}`,'13370000-0000-4000-8000-000000000000');
      localStorage.setItem(`village:face-badge:${uid}`,'seen');
      localStorage.setItem(`village:guide:v1:${uid}`,'seen');
    },seat);
    return context;
  }));
  const [a,b] = await Promise.all(contexts.map(c=>c.newPage()));
  try {
    await Promise.all([a,b].map(p=>p.goto('/')));
    await Promise.all([a,b].map(p=>expect(p.locator('[data-player="true"]')).toBeVisible({timeout:60000})));
    const actor = a.locator('[data-player="true"]');
    const id = await actor.getAttribute('data-testid');
    const peer = b.getByTestId(id!);
    // Dismiss optional onboarding without invoking any model/provider action.
    for (const p of [a,b]) {
      const close = p.getByRole('button',{name:/^(Close|Not now|Maybe later)$/});
      if (await close.first().isVisible()) await close.first().click();
    }
    clipStart = Math.max(0,(Date.now()-started)/1000-1);
    await a.keyboard.down('KeyS');
    await expect(peer).toHaveAttribute('data-mode','walking',{timeout:15000});
    const before = Number(await peer.getAttribute('data-z'));
    await a.waitForTimeout(1200);
    const after = Number(await peer.getAttribute('data-z'));
    expect(Math.abs(after-before)).toBeGreaterThan(.2);
    await expect(peer).toContainText('Walking');
    await Promise.all([a.screenshot({path:info.outputPath('seat-a-walking.png')}),b.screenshot({path:info.outputPath('seat-b-walking.png')})]);
    await a.keyboard.up('KeyS');
    await expect(peer).toHaveAttribute('data-mode','idle');
    await a.keyboard.press('Digit2');
    await expect(peer).toHaveAttribute('data-mode','emote');
    await expect(peer).not.toHaveAttribute('data-mode','emote');
    await contexts[1].setOffline(true);
    await b.waitForTimeout(500);
    await contexts[1].setOffline(false);
    await b.waitForTimeout(1500);
    await a.keyboard.down('KeyS');
    await expect(peer).toHaveAttribute('data-mode','walking',{timeout:15000});
    await a.keyboard.up('KeyS');
  } finally { await Promise.all(contexts.map(c=>c.close())); }
  execFileSync('ffmpeg',['-y','-ss',String(clipStart),'-i',await a.video()!.path(),
    '-ss',String(clipStart),'-i',await b.video()!.path(),'-filter_complex','[0:v][1:v]hstack=inputs=2:shortest=1[v]',
    '-map','[v]','-t','20','-c:v','libx264','-preset','fast','-pix_fmt','yuv420p',info.outputPath('two-windows.mp4')],{stdio:'pipe'});
});
