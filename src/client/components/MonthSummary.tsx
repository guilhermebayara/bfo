import { useEffect, useState } from 'react';
import { api } from '../api';
import { SidePanel, State, Truncated } from './index';
import { formatMoney } from '../../shared/money';
type Item = {
  category_id: string | null;
  category_name: string;
  group_name: string;
  is_income: number;
  exclude_budget: number;
  amount_cents: number;
};
export function MonthSummary({
  month,
  revision,
}: {
  month: string;
  revision: number;
}) {
  const [items, setItems] = useState<Item[] | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    setError('');
    setItems(null);
    api<Item[]>(`/month-summary?month=${month}`, { signal: abort.signal })
      .then(setItems)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => abort.abort();
  }, [month, revision]);
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
          const list = items.filter((i) => i.is_income === income),
            total = list.reduce((sum, i) => sum + i.amount_cents, 0),
            max = Math.max(1, ...list.map((i) => Math.abs(i.amount_cents)));
          return (
            <div key={income} className="summary-section">
              <h3>
                {income ? 'Renda' : 'Despesas'}{' '}
                <span>{formatMoney(total)}</span>
              </h3>
              {!list.length && <small>Sem lançamentos</small>}
              {[...new Set(list.map((i) => i.group_name))].map((group) => (
                <div key={group}>
                  <div className="summary-group">
                    <strong>
                      <Truncated>{group}</Truncated>
                    </strong>
                    <span>
                      {formatMoney(
                        list
                          .filter((i) => i.group_name === group)
                          .reduce((sum, i) => sum + i.amount_cents, 0),
                      )}
                    </span>
                  </div>
                  {list
                    .filter((i) => i.group_name === group)
                    .map((i) => (
                      <div
                        key={i.category_id ?? 'none'}
                        className="summary-category"
                      >
                        <div>
                          <Truncated>{i.category_name}</Truncated>
                          <span>{formatMoney(i.amount_cents)}</span>
                        </div>
                        <progress
                          aria-label={`${i.category_name}: ${formatMoney(i.amount_cents)}`}
                          value={Math.abs(i.amount_cents)}
                          max={max}
                        />
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
