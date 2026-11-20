import { test as base } from '@playwright/test';

export const testDay = '2026-11-19';

export function clockHeaders(day: string) {
  return { 'x-bfo-data': day };
}

export const test = base.extend({
  extraHTTPHeaders: clockHeaders(testDay),
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(new Date(`${testDay}T12:00:00-03:00`));
    await use(page);
  },
});

export { expect, type APIRequestContext } from '@playwright/test';
