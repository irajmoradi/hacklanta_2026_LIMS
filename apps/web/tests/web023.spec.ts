import { test } from '@playwright/test';

test('WEB-023 real API lazy town and interactive wardrobe', async () => {
  test.setTimeout(120000);
  await import('./web023-real.mjs' as string);
});
