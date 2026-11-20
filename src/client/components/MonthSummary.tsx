import { Privacy, useMoney } from '../privacy';
import { useContext, useEffect, useState } from 'react';
import { api } from '../api';
import type { MonthSummaryItem } from '../../shared/home';
import {
  transactionsUrl,
  type TransactionFilters,
} from '../transaction-filters';
import { SidePanel, State, Truncated } from './index';
export function MonthSummary({
  month,
  revision,
  navigate,
}: {
  month: string;
  revision: number;
  navigate: (to: string) => void;
}) {
  const formatMoney = useMoney();
  const hidden = useContext(Privacy);
  const [items, setItems] = useState<MonthSummaryItem[] | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    setError('');
    setItems(null);
    api<MonthSummaryItem[]>(`/month-summary?month=${month}`, {
      signal: abort.signal,
    })
      .then(setItems)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => abort.abort();
  }, [month, revision]);
  function amount(label: string, cents: number, filters: TransactionFilters) {
    const href = transactionsUrl(month, filters);
    const value = formatMoney(cents);
    return (
      <a
        href={href}
        aria-label={`${label}: ${value}. Ver transações`}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          navigate(href);
        }}
      >
        {value}
      </a>
    );
  }
  return (
    <SidePanel className="month-summary" aria-label="Resumo do mês">
      <h2>Resumo do mês</h2>
      <small>Em reais · mês completo</small>
      {error ? (
        <State kind="error">{error}</State>
      ) : !items ? (
        <State kind="loading">Carregando resumo…</State>
      ) : (
        [1, 0].map((income) => {
          const list = items.filter((i) => i.is_income === income);
          const summary = income ? 'income' : 'expense';
          const label = income ? 'Renda' : 'Despesas';
          const total = list.reduce((sum, i) => sum + i.amount_cents, 0);
          const max = Math.max(1, ...list.map((i) => Math.abs(i.amount_cents)));
          const groups = new Map<string, MonthSummaryItem[]>();
          for (const item of list) {
            const group = item.group_id ?? 'none';
            const entries = groups.get(group) ?? [];
            entries.push(item);
            groups.set(group, entries);
          }
          return (
            <div key={income} className="summary-section">
              <h3>
                {label} {amount(label, total, { summary })}
              </h3>
              {!list.length && <small>Sem lançamentos</small>}
              {[...groups].map(([group, entries]) => (
                <div key={group}>
                  <div className="summary-group">
                    <strong>
                      <Truncated>{entries[0].group_name}</Truncated>
                    </strong>
                    {amount(
                      entries[0].group_name,
                      entries.reduce((sum, i) => sum + i.amount_cents, 0),
                      { summary, group },
                    )}
                  </div>
                  {entries.map((i) => (
                    <div
                      key={i.category_id ?? 'none'}
                      className="summary-category"
                    >
                      <div>
                        <Truncated>{i.category_name}</Truncated>
                        {amount(i.category_name, i.amount_cents, {
                          summary,
                          group,
                          category: i.category_id ?? 'none',
                        })}
                      </div>
                      {!hidden && (
                        <progress
                          aria-label={`${i.category_name}: ${formatMoney(i.amount_cents)}`}
                          value={Math.abs(i.amount_cents)}
                          max={max}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })
      )}
    </SidePanel>
  );
}
