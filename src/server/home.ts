import type { DueItem, Projection, ProjectionEntry } from '../shared/home';
import { convert } from '../shared/money';
import type { Account, Recurring } from '../shared/types';

export type ActiveRecurring = Recurring & { effective_income: number };
export type RecurringProjection = { r: ActiveRecurring; date: string };

export async function projectAvailable(
  db: D1Database,
  today: string,
  to: string,
  accounts: Account[],
  recurring: ActiveRecurring[],
  upcoming: DueItem[],
): Promise<Projection> {
  const cash = accounts.filter(
    (a) => a.kind === 'checking' || a.kind === 'cash',
  );
  const ids = new Set(cash.map((a) => a.id));
  const incomeIds = new Set(
    recurring
      .filter(
        (r) =>
          ids.has(r.account_id) && r.effective_income && r.amount_cents < 0,
      )
      .map((r) => r.id),
  );
  const missingRates = new Set<string>();
  const rates = new Map<string, number | null>([['BRL', 1]]);
  const entries: { item: DueItem; kind: ProjectionEntry['kind'] }[] = [];
  for (const item of upcoming) {
    if (item.type === 'statement') {
      if (item.amount_cents > 0) entries.push({ item, kind: 'expense' });
      continue;
    }
    if (!ids.has(item.account_id)) continue;
    if (item.destination_account_id && ids.has(item.destination_account_id))
      continue;
    if (item.amount_cents > 0 && item.date >= today) {
      entries.push({ item, kind: 'expense' });
    } else if (item.amount_cents < 0 && item.type === 'scheduled') {
      entries.push({ item, kind: 'scheduled_income' });
    } else if (item.recurring_id && incomeIds.has(item.recurring_id)) {
      entries.push({ item, kind: 'income' });
    }
  }
  const currencies = new Set([
    ...cash.filter((a) => a.balance_cents).map((a) => a.currency),
    ...entries.map(({ item }) => item.currency),
  ]);
  for (const currency of currencies) {
    if (rates.has(currency)) continue;
    const quote = await db
      .prepare(
        `SELECT rate FROM (
      SELECT * FROM (SELECT date,rate,1 AS preferred FROM fx_rates WHERE currency=? AND date<=? ORDER BY date DESC LIMIT 1)
      UNION ALL
      SELECT * FROM (SELECT date,fx_rate AS rate,0 AS preferred FROM active_transactions
        WHERE currency=? AND date<=? AND amount_cents<>0 ORDER BY date DESC,created_at DESC,id DESC LIMIT 1)
    ) ORDER BY date DESC,preferred DESC LIMIT 1`,
      )
      .bind(currency, today, currency, today)
      .first<{ rate: number }>();
    rates.set(currency, quote?.rate ?? null);
  }
  function inBrl(cents: number, currency: string) {
    if (!cents) return 0;
    const rate = rates.get(currency);
    if (rate == null) {
      missingRates.add(currency);
      return null;
    }
    return convert(cents, rate);
  }
  const balances = cash.map(({ id, name, currency, balance_cents }) => ({
    id,
    name,
    currency,
    balance_cents,
    brl_cents: inBrl(balance_cents, currency),
  }));
  const opening = balances.reduce((sum, a) => sum + (a.brl_cents ?? 0), 0);
  const changes = new Map<string, number>();
  const totals = { income: 0, scheduled_income: 0, expense: 0 };
  const converted = entries.map(({ item, kind }) => {
    const date = item.date < today ? today : item.date;
    const brl_cents = inBrl(Math.abs(item.amount_cents), item.currency);
    const amount = brl_cents ?? 0;
    totals[kind] += amount;
    changes.set(
      date,
      (changes.get(date) ?? 0) + (kind === 'expense' ? -amount : amount),
    );
    return { item, kind, date, brl_cents };
  });
  let ending = opening;
  let low = opening;
  let lowDate = today;
  for (const [day, change] of changes) {
    ending += change;
    if (ending < low) {
      low = ending;
      lowDate = day;
    }
  }
  return {
    to,
    balances,
    entries: converted,
    missing_rates: [...missingRates],
    has_income_recurring: incomeIds.size > 0,
    opening_cents: opening,
    income_cents: totals.income,
    scheduled_income_cents: totals.scheduled_income,
    expense_cents: totals.expense,
    ending_cents: ending,
    low_cents: low,
    low_date: lowDate,
  };
}
