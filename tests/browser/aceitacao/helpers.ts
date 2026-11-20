import { expect, type Page, type APIRequestContext } from '@playwright/test';

/** Data fixa exigida pela Sessão M: 2026-11-15. */
export async function freezeToday(page: Page) {
  await page.clock.install({ time: new Date('2026-11-15T15:00:00-03:00') });
}

export const ACTIVE = 'seed-f-account';
export const CASH = 'seed-h-destination';

export async function createTx(
  request: APIRequestContext,
  body: Record<string, unknown> = {},
) {
  const response = await request.post('/api/transactions', {
    data: {
      account_id: ACTIVE,
      date: '2026-11-10',
      amount_cents: 2500,
      payee: 'QA browser',
      category_id: 'groceries',
      ...body,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string; installment_plan_id?: string };
}
