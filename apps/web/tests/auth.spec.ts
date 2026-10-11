import { expect, test } from '@playwright/test';

test('configured Auth0 displays sign-in and requests the API audience', async ({ page, baseURL }) => {
  let authorize: URL | undefined;
  await page.route('https://village-test.auth0.com/**', route => {
    authorize = new URL(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic identity provider</h1>' });
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByLabel('Play as')).not.toBeVisible();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Synthetic identity provider' })).toBeVisible();
  expect(authorize?.pathname).toBe('/authorize');
  expect(authorize?.searchParams.get('audience')).toBe('https://api.village.test');
  expect(authorize?.searchParams.get('client_id')).toBe('synthetic-client');
  expect(authorize?.searchParams.get('redirect_uri')).toBe(new URL(baseURL!).origin);
  expect(authorize?.searchParams.get('code_challenge_method')).toBe('S256');
});
