import { useDemoSeat } from './demoSeat';
useDemoSeat();
import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const real = process.env.FEAT001_REAL === '1';
const mode = real ? 'real' : 'mock';
const out = 'tests/artifacts/feat001';

test.beforeEach(async ({page}) => {
  await expect(async () => {
    await page.goto('/');
    if (real) await expect(page.getByText('Connected', {exact: true})).toBeAttached({timeout: 5000});
  }).toPass({timeout: 60000, intervals: [1000]});
});

test('complete goal, celebrate, react across wall/profile/feed and change viewer', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('button', {name: 'My profile', exact: true}).click();
  const section = page.locator('.profile-section').filter({hasText: 'THIS WEEK'});
  const title = await section.locator('h3').innerText();
  await section.getByRole('button', {name: 'Mark done', exact: true}).click();
  await expect(page.locator('.goal-burst')).toHaveAttribute('aria-label', 'Iraj completed a goal');
  await expect(section.getByText('Goal: done', {exact: true})).toBeVisible();
  await section.getByRole('button', {name: 'React 🎉', exact: true}).click();
  await expect(section.getByRole('button', {name: 'React 🎉', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: 'Close profile'}).click();
  await page.locator('.feed-accomplishments').click();
  const wall = page.getByRole('dialog', {name: 'Accomplishments', exact: true});
  const card = wall.locator('article').filter({has: page.getByRole('heading', {name: title, exact: true})});
  const reaction = card.getByRole('button', {name: 'React 🎉', exact: true});
  await expect(reaction).toHaveAttribute('aria-pressed', 'true');
  await expect(reaction).toContainText('1');
  await reaction.click(); await expect(reaction).toHaveAttribute('aria-pressed', 'false');
  await card.getByRole('button', {name: 'React 🔥', exact: true}).click();
  await expect(card.getByRole('button', {name: 'React 🔥', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByRole('button', {name: 'React 🔥', exact: true})).toBeEnabled();
  await mkdir(out, {recursive: true});
  await page.screenshot({path: `${out}/${mode}-desktop-wall.png`});
  await wall.getByRole('button', {name: /Close/}).click();
  const feed = page.locator('.feed-list article').filter({hasText: `completed a goal: ${title}`});
  await feed.getByRole('button', {name: 'React 👏', exact: true}).click();
  await expect(feed.getByRole('button', {name: 'React 👏', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: 'My profile', exact: true}).click();
  await expect(section.getByRole('button', {name: 'React 🔥', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({path: `${out}/${mode}-profile.png`});
  await page.getByRole('button', {name: 'Close profile'}).click();
  await page.locator('.user-picker select').selectOption({label: 'Lance'});
  await page.locator('.feed-accomplishments').click();
  await expect(card.getByRole('button', {name: 'React 🔥', exact: true})).toHaveAttribute('aria-pressed', 'false');
  await card.getByRole('button', {name: 'React 🔥', exact: true}).click();
  await expect(card.getByRole('button', {name: 'React 🔥', exact: true})).toContainText('2');
  await expect(page.locator('.goal-burst')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('mobile accomplishments is reachable and fits the viewport', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.getByRole('button', {name: 'More', exact: true}).click();
  await page.getByRole('button', {name: 'Accomplishments', exact: true}).last().click();
  const wall = page.getByRole('dialog', {name: 'Accomplishments', exact: true});
  await expect(wall.locator('article').first()).toBeVisible();
  const reaction = wall.locator('article').first().getByRole('button', {name: 'React ❤️', exact: true});
  await reaction.click(); await expect(reaction).toHaveAttribute('aria-pressed', 'true');
  await expect(reaction).toBeEnabled({timeout: 35000});
  expect(await wall.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await reaction.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await mkdir(out, {recursive: true}); await page.screenshot({path: `${out}/${mode}-mobile-wall.png`});
});

test('feed shortcut leaves the profile reachable on a short laptop screen', async ({page}) => {
  await page.setViewportSize({width: 1280, height: 720});
  const profile = page.getByRole('button', {name: 'My profile', exact: true});
  await profile.click();
  await expect(page.getByRole('heading', {name: 'Iraj', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Close profile'}).click();
  await page.locator('.feed-accomplishments').click();
  await expect(page.getByRole('dialog', {name: 'Accomplishments', exact: true})).toBeVisible();
  await expect(page.locator('.accomplishment-card').first()).toBeVisible();
  await page.screenshot({path: `${out}/${mode}-laptop-wall.png`});
});

test('real reaction error rolls back optimistic state and permits retry', async ({page}) => {
  test.skip(!real, 'HTTP failure simulation exercises the real client.');
  await page.locator('.feed-accomplishments').click();
  const card = page.locator('.accomplishment-card').first();
  const reaction = card.getByRole('button', {name: 'React 🤯', exact: true});
  if (await reaction.getAttribute('aria-pressed') === 'true') {
    await reaction.click();
    await expect(reaction).toBeEnabled({timeout: 35000});
  }
  await expect(reaction).toHaveAttribute('aria-pressed', 'false');
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/api/villages/*/reactions', async route => {await gate; await route.fulfill({status: 503, json: {detail: 'Try again soon'}});});
  await reaction.click(); await expect(reaction).toHaveAttribute('aria-pressed', 'true');
  release(); await expect(card.getByRole('alert')).toContainText('Try again soon');
  await expect(reaction).toHaveAttribute('aria-pressed', 'false');
  await page.unroute('**/api/villages/*/reactions');
  await reaction.click(); await expect(reaction).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByRole('alert')).toHaveCount(0);
  await expect(reaction).toBeEnabled({timeout: 35000});
  await expect(reaction).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({path: `${out}/real-desktop-wall.png`});
});
