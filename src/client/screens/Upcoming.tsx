import { transactionsUrl } from '../transaction-filters';
import { useMoney } from '../privacy';
import { useEffect, useState } from 'react';
import { api, humanDate } from '../api';
import { PageHeader, Panel, State, Truncated, Table } from '../components';
type Due = {
  id: string;
  type: string;
  label: string;
  date: string;
  amount_cents: number;
  currency: string;
  account_name: string;
  account_id: string;
  components: {
    id: string;
    type: string;
    label: string;
    amount_cents: number;
    date?: string;
  }[];
};
export function Upcoming({ revision }: { revision: number }) {
  const formatMoney = useMoney();
  const [data, setData] = useState<{
      from: string;
      to: string;
      items: Due[];
    } | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    api<typeof data>('/upcoming', { signal: abort.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => abort.abort();
  }, [revision]);
  return (
    <>
      <PageHeader
        title="Próximos"
        context={
          data
            ? `De ${humanDate(data.from)} a ${humanDate(data.to)}`
            : 'Vencimentos deste mês e do próximo'
        }
      />
      {error ? (
        <State kind="error">{error}</State>
      ) : !data ? (
        <State kind="loading">Carregando próximos vencimentos…</State>
      ) : (
        <>
          <p className="section-help">
            Parcelas e recorrentes do cartão compõem as faturas. Cada valor
            entra uma vez no total. Lançamento com data futura aparece até o dia
            chegar.
          </p>
          {[data.from.slice(0, 7), data.to.slice(0, 7)].map((month) => {
            const list = data.items.filter((i) => i.date.startsWith(month));
            const totals: Record<string, number> = {};
            for (const i of list)
              totals[i.currency] = (totals[i.currency] ?? 0) + i.amount_cents;
            return (
              <Panel className="account-group" key={month}>
                <h2>
                  {new Intl.DateTimeFormat('pt-BR', {
                    month: 'long',
                    year: 'numeric',
                    timeZone: 'UTC',
                  }).format(new Date(month + '-01T12:00:00Z'))}
                </h2>
                {Object.entries(totals).map(([currency, amount]) => (
                  <p className="section-total" key={currency}>
                    Saldo previsto de saídas e entradas{' '}
                    <strong>{formatMoney(amount, currency)}</strong>
                  </p>
                ))}
                {list.length ? (
                  <Table
                    label={`Vencimentos de ${month}`}
                    numeric={[3]}
                    widths={['16%', '42%', '25%', '17%']}
                    headers={['Vencimento', 'Lançamento', 'Conta', 'Valor']}
                  >
                    {list.map((i) => (
                      <tr key={i.id}>
                        <td>{humanDate(i.date)}</td>
                        <td>
                          {i.type === 'statement' ? (
                            <a
                              href={`/cartao?account=${encodeURIComponent(i.account_id)}&statement=${encodeURIComponent(i.id)}`}
                            >
                              <Truncated>{i.label}</Truncated>
                            </a>
                          ) : (
                            <Truncated>{i.label}</Truncated>
                          )}
                          {i.components.length > 0 && (
                            <details>
                              <summary>Parcelas, compras e recorrentes</summary>
                              <ul>
                                {i.components.map((p) => (
                                  <li key={p.id}>
                                    {p.label}:{' '}
                                    {p.date ? (
                                      <a
                                        href={transactionsUrl(
                                          p.date.slice(0, 7),
                                          {
                                            account: i.account_id,
                                            transaction: p.id,
                                          },
                                        )}
                                        aria-label={`Valor de ${p.label}: ${formatMoney(p.amount_cents, i.currency)}. Ver transação`}
                                      >
                                        {formatMoney(
                                          p.amount_cents,
                                          i.currency,
                                        )}
                                      </a>
                                    ) : (
                                      formatMoney(p.amount_cents, i.currency)
                                    )}
                                    {p.type === 'installment'
                                      ? ' · Parcela'
                                      : ''}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </td>
                        <td>
                          <Truncated>{i.account_name}</Truncated>
                        </td>
                        <td className="numeric">
                          {['scheduled', 'transfer', 'payment'].includes(
                            i.type,
                          ) ? (
                            <a
                              href={transactionsUrl(i.date.slice(0, 7), {
                                account: i.account_id,
                                transaction: i.id,
                              })}
                              aria-label={`Valor de ${i.label}: ${formatMoney(i.amount_cents, i.currency)}. Ver transação`}
                            >
                              {formatMoney(i.amount_cents, i.currency)}
                            </a>
                          ) : (
                            formatMoney(i.amount_cents, i.currency)
                          )}
                        </td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <State kind="empty">Nenhum vencimento previsto.</State>
                )}
              </Panel>
            );
          })}
        </>
      )}
    </>
  );
}
