import {test,expect} from '@playwright/test';
import {useDemoSeat} from './demoSeat';
useDemoSeat();
for(const mode of ['Cumulative','Scoreboard','Ordinal']) {
  test(`create ${mode}, tab-driven gate and podium`,async({page})=>{
    await page.goto('/');await page.getByRole('button',{name:'Compete',exact:true}).click();
    await page.getByRole('button',{name:/\+ Create/}).click();
    await page.getByRole('group',{name:'Scoring mode'}).getByRole('button',{name:mode,exact:true}).click();
    await page.getByLabel('Competition title').fill(`${mode} challenge`);
    await page.getByLabel('Terms',{exact:true}).fill('Confirm each focused session.');
    if(mode!=='Cumulative')await page.getByLabel('Friendly mode',{exact:false}).check();
    if(mode!=='Cumulative'){await page.getByLabel('Unit',{exact:true}).fill('hours');await page.getByLabel('Optional target').fill('10');}
    await page.getByRole('button',{name:'Create competition with these terms'}).click();
    await expect(page.getByLabel('Arena status')).toContainText(mode);
    await expect(page.getByRole('button',{name:'View open',exact:true})).toHaveCount(0);
    const tabs=page.getByRole('navigation',{name:'Competition list filters'});
    await tabs.getByRole('button',{name:'Open',exact:true}).click();
    await expect(page.getByLabel('Arena status')).toContainText('Gate closed');
    await page.getByRole('button',{name:'Join',exact:false}).filter({hasText:'Free'}).click();
    await page.getByRole('button',{name:/Confirm join/}).click();
    await tabs.getByRole('button',{name:'Current',exact:true}).click();
    await expect(page.getByLabel('Arena status')).toContainText('Arena floor');
    await expect(page.getByLabel('Arena status')).toContainText('1 participants');
    await page.getByRole('button',{name:'Submit / manage competition'}).click();
    if(mode!=='Cumulative'){
      await page.getByLabel('Claimed value (hours)').fill('2.5');
      await page.getByLabel('Entry description').fill('A focused session completed.');
      await page.getByRole('button',{name:'Submit entry',exact:true}).click();
      await expect(page.getByRole('button',{name:'Progress of Iraj'})).toContainText('2.5 hours');
      await expect(page.getByRole('progressbar',{name:'Iraj target progress'})).toHaveAttribute('value','25');
    }
    await page.screenshot({path:`tests/screenshots/FEAT-014/create-${mode.toLowerCase()}.png`});
    await tabs.getByRole('button',{name:'Mine',exact:true}).click();
    await expect(page.getByRole('button',{name:new RegExp(`${mode} challenge`)})).toBeVisible();
  });
}
test('auditor booth review updates ranks, shortcuts and settled past view',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'Compete',exact:true}).click();
  await page.getByRole('button',{name:/The seven-day sprint/}).click();
  const booth=page.getByLabel('Auditor booth',{exact:true});
  await expect(booth).toContainText('Auditor · sits out');
  await expect(booth).toContainText('Review 1/4');
  await expect(booth.getByRole('button',{name:'Settle competition'})).toBeDisabled();
  await booth.getByLabel('Auditor note').fill('Evidence checked.');
  await booth.getByLabel('Award points').fill('40');
  await booth.getByRole('button',{name:'Approve',exact:true}).click();
  await expect(page.getByRole('button',{name:'Progress of Lance'})).toContainText('70 points');
  await expect(booth).toContainText('Review 1/3');
  await page.screenshot({path:'tests/screenshots/FEAT-014/auditor-booth.png'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'tests/screenshots/FEAT-014/auditor-mobile.png'});
  await page.setViewportSize({width:1440,height:1000});
  await page.keyboard.press('j');await expect(booth.getByRole('navigation')).toContainText('Review 2/3');
  await page.keyboard.press('k');await expect(booth.getByRole('navigation')).toContainText('Review 1/3');
  for(let i=0;i<3;i++){
    await booth.getByLabel('Auditor note').fill('Insufficient evidence.');
    await booth.getByLabel('Auditor note').blur();await page.keyboard.press('r');
    await expect(booth).toContainText(i===2?'No pending entries.':`Review 1/${2-i}`);
  }
  await booth.getByRole('button',{name:'Settle competition'}).click();
  await expect(booth).toContainText('Final results recorded');
  await page.getByRole('navigation',{name:'Competition list filters'}).getByRole('button',{name:'Past',exact:true}).click();
  await expect(page.getByRole('button',{name:/The seven-day sprint/})).toBeVisible();
  await page.screenshot({path:'tests/screenshots/FEAT-014/past.png'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'tests/screenshots/FEAT-014/past-mobile.png'});
  expect(errors).toEqual([]);
});
