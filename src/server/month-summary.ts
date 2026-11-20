import type { MonthComparison, MonthSummaryItem } from '../shared/home';
import { monthBounds, shiftMonth } from '../shared/recurring';

export const monthlyAmountSql =
  'CASE WHEN mt.is_income=1 THEN -mt.amount_brl_cents ELSE mt.amount_brl_cents END';
export const monthlyDateSql =
  "CASE WHEN mt.kind='installment' THEN COALESCE(s.due_date,mt.date) ELSE mt.date END";
export const monthlyDateJoin = 'LEFT JOIN statements s ON s.id=mt.statement_id';

export async function readMonthSummary(
  db: D1Database,
  month: string,
  through?: string,
) {
  const { results } = await db
    .prepare(
      `SELECT mt.category_id,COALESCE(cat.name,'Sem categoria') AS category_name,
    COALESCE(g.name,'Sem grupo') AS group_name,g.id AS group_id,mt.is_income,mt.exclude_budget,
    SUM(${monthlyAmountSql}) AS amount_cents
    FROM monthly_totals mt LEFT JOIN categories cat ON cat.id=mt.category_id
    LEFT JOIN category_groups g ON g.id=cat.category_group_id ${through ? monthlyDateJoin : ''}
    WHERE mt.spending_month=? ${through ? `AND ${monthlyDateSql}<=?` : ''}
    GROUP BY mt.category_id,mt.is_income,mt.exclude_budget ORDER BY mt.is_income DESC,g.sort,g.name,cat.name`,
    )
    .bind(month, ...(through ? [through] : []))
    .all<MonthSummaryItem>();
  return results;
}

export async function compareMonth(
  db: D1Database,
  day: string,
): Promise<MonthComparison> {
  const month = day.slice(0, 7);
  const previousMonth = shiftMonth(month, -1);
  const previousBounds = monthBounds(previousMonth);
  const sameDay = previousMonth + day.slice(7);
  const current = { month, from: monthBounds(month).from, to: day };
  const previous = {
    month: previousMonth,
    from: previousBounds.from,
    to: sameDay < previousBounds.to ? sameDay : previousBounds.to,
  };
  const [currentRows, previousRows] = await Promise.all([
    readMonthSummary(db, current.month, current.to),
    readMonthSummary(db, previous.month, previous.to),
  ]);
  const groups = new Map<string, MonthComparison['groups'][number]>();
  for (const [field, rows] of [
    ['current_cents', currentRows],
    ['previous_cents', previousRows],
  ] as const) {
    for (const row of rows) {
      const key = `${row.is_income}:${row.group_id ?? ''}`;
      const group = groups.get(key) ?? {
        id: row.group_id,
        label: row.group_name,
        is_income: row.is_income,
        current_cents: 0,
        previous_cents: 0,
      };
      group[field] += row.amount_cents;
      groups.set(key, group);
    }
  }
  return { current, previous, groups: [...groups.values()] };
}
