import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// Component-level layout tests use the shipped CSS, without the 3D renderer.
test('QA14-09 terms never cover challenge filters or banners', async ({page}) => {
  const css = ['src/components/colosseum.css','src/components/ModalHeader.css'].map(path=>readFileSync(path,'utf8')).join('\n');
  await page.setContent(`<style>${css}</style><dialog open class="modal arena-modal">
    <aside class="arena-browser"><header class="modal-header"><h2>Challenges</h2></header>
    <nav aria-label="Competition list filters"><button>Current</button><button>Mine</button><button>Past</button></nav>
    <button class="arena-create-banner">Create</button><div class="arena-banner-list"><button class="arena-banner">Study streak</button></div></aside>
    <section class="colosseum"><aside class="arena-card"><h3>The invitation</h3><p>${'Long terms '.repeat(200)}</p></aside></section></dialog>`);
  for (const name of ['Current','Mine','Past','Study streak']) await page.getByRole('button',{name,exact:true}).click({trial:true});
  const list = (await page.locator('.arena-browser').boundingBox())!;
  const terms = (await page.locator('.arena-card').boundingBox())!;
  expect(list.x+list.width <= terms.x || terms.x+terms.width <= list.x || list.y+list.height <= terms.y).toBe(true);
});

test('QA14-04 header and dock expose all actions without horizontal scrolling', async ({page}) => {
  const css = readFileSync('src/styles.css','utf8');
  await page.setContent(`<style>${css}</style><div class="app"><header class="topbar"><div class="topbar-right">
    <button class="demo-seat-switch">Testing as Iraj · switch</button>${['AI at work','Help','Inbox','Settings','My profile'].map(label=>`<button class="button">${label}</button>`).join('')}
    </div></header><nav class="action-dock">${['Check in','Village','My goal','Weekly review','Compete','Mayor','Shop'].map(label=>`<button>${label}</button>`).join('')}</nav></div>`);
  for (const button of await page.getByRole('button').all()) {
    await expect(button).toBeInViewport(); await button.click({trial:true});
  }
  const overflow=await page.locator('.topbar-right,.action-dock').evaluateAll(rows=>rows.some(row=>row.scrollWidth>row.clientWidth+1));
  expect(overflow).toBe(false);
});
