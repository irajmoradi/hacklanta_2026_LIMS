import { expect, test } from '@playwright/test';
import { useDemoSeat } from './demoSeat';
useDemoSeat();

for (const mobile of [false, true]) test(`weekly review excludes all auditors (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Weekly review', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Weekly review' });
  await expect(dialog.getByText('Iraj is the auditor and sits out this week', { exact: true })).toBeVisible();
  await expect(dialog.locator('.weekly-auditor .portrait')).toHaveCount(1);
  await expect(dialog.getByRole('article')).toHaveCount(4);
  await expect(dialog.getByRole('article', { name: "Iraj's weekly goal" })).toHaveCount(0);
  await expect(dialog.getByText('Small steps count. Share the journey with your people.', { exact: true })).toHaveCount(0);
  // Use the same in-memory API as the UI; never contact the live demo village.
  await page.evaluate(async () => {
    const { api } = await import('/src/api/client.ts' as string);
    const village = await api.village('11111111-1111-4111-8111-111111111111');
    const week = await api.week(village.id);
    const originalUser = api.user;
    api.user = village.villagers[2].user_id;
    await api.goal(village.id, 'Make a little art every day', 'Finish three watercolor studies.');
    api.user = village.villagers[3].user_id;
    await api.goal(village.id, 'Finish my first music mix', 'Small steps count. Share the journey with your people.');
    for (const person of village.villagers.filter((v: any) => v.user_id !== week.auditor_id).slice(0, 3)) {
      api.user = person.user_id;
      await api.vote(village.id, week.week_start, week.generation);
    }
    api.user = originalUser;
  });
  await expect(dialog.getByRole('article')).toHaveCount(3, { timeout: 15000 });
  await expect(dialog.getByRole('article', { name: "Iraj's weekly goal" })).toHaveCount(0);
  await expect(dialog.getByRole('article', { name: "Lance's weekly goal" })).toHaveCount(0);
  await expect(dialog.getByText('Lance is the auditor and sits out this week', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Finish three watercolor studies.', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Small steps count. Share the journey with your people.', { exact: true })).toHaveCount(0);
  await expect(dialog.locator('.weekly-goal-detail')).toHaveCount(1);
  await dialog.screenshot({ path: `artifacts/fix013/weekly-${mobile ? 'mobile' : 'desktop'}.png` });
});
