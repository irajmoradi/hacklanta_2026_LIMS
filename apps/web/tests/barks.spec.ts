import { expect, test } from '@playwright/test';
test('mock voice bark setting defaults on and persists for the current user',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('village:seat:mock','00000000-0000-4000-8000-000000000001');
    localStorage.setItem('village:guide:v1:00000000-0000-4000-8000-000000000001','seen');
    localStorage.setItem('village:face-badge:00000000-0000-4000-8000-000000000001','seen');
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Open Settings',exact:true}).click();
  const toggle=page.getByRole('switch',{name:'Voice barks',exact:true});
  await expect(toggle).toBeChecked();await toggle.uncheck();await toggle.scrollIntoViewIfNeeded();
  await page.locator('.settings-card').filter({has:page.getByRole('heading',{name:'Sound',exact:true})}).evaluate(el=>el.scrollIntoView({block:'center'}));
  await page.screenshot({path:'tests/artifacts/barks/settings.png'});
  await page.reload();await page.getByRole('button',{name:'Open Settings',exact:true}).click();
  await expect(toggle).not.toBeChecked();
});
