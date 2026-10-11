import { test } from '@playwright/test';

// Older feature suites begin after choosing a seat. FEAT-004 tests first-visit onboarding separately.
export function useDemoSeat(showGuide = false) {
 test.beforeEach(async ({ context }) => {
  await context.addInitScript((showGuide: boolean) => {
    // Seat-switching flows also begin after onboarding. Keep first-visit guide
    // coverage explicit via showGuide rather than interrupting an unrelated flow.
    if (!showGuide) for (let seat=1;seat<=5;seat++) {
      localStorage.setItem(`village:guide:v1:00000000-0000-4000-8000-00000000000${seat}`, 'seen');
    }
    if (!localStorage.getItem('village:seat:mock')) localStorage.setItem('village:seat:mock', '00000000-0000-4000-8000-000000000001');
    if (!localStorage.getItem('village:seat:live')) localStorage.setItem('village:seat:live', '13370000-0000-4000-8000-000000000001');
  }, showGuide);
});
}
