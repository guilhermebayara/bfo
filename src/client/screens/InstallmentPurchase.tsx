import { useEffect, useState } from 'react';
import type { Account, InstallmentPlan, Transaction } from '../../shared/types';
import { formatMoney } from '../../shared/money';
import { api, humanDate } from '../api';
import { Table } from '../components';

type Purchase = {
  plan: InstallmentPlan;
  installments: (Pick<
    Transaction,
    | 'id'
    | 'date'
    | 'amount_cents'
    | 'amount_brl_cents'
    | 'note'
    | 'installment_number'
  > & {
    statement_id: string | null;
    due_date: string | null;
  })[];
};

export function InstallmentPurchase({
  id,
  accounts,
}: {
  id: string;
  accounts: Account[];
}) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    api<Purchase>(`/installment-plans/${encodeURIComponent(id)}`, {
      signal: abort.signal,
    })
      .then(setPurchase)
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [id]);
  return (
    <>
      <a href="/transacoes">Voltar a Transações</a>
      <h1>Compra parcelada</h1>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : !purchase ? (
        <p role="status">Carregando compra…</p>
      ) : (
        <>
          <h2>{purchase.plan.description}</h2>
          <p>
            {accounts.find((a) => a.id === purchase.plan.account_id)?.name} ·{' '}
            {humanDate(purchase.plan.first_date)} ·{' '}
            {formatMoney(purchase.plan.total_cents, purchase.plan.currency)} em{' '}
            {purchase.plan.count} parcelas
          </p>
          <Table
            label="Parcelas da compra"
            headers={['Parcela', 'Data', 'Valor', 'Fatura', 'Nota']}
          >
            {purchase.installments.map((item, i) => (
              <tr key={item.id}>
                <td>
                  {item.installment_number ?? i + 1}/{purchase.plan.count}
                </td>
                <td>{humanDate(item.date)}</td>
                <td className="numeric">
                  {formatMoney(item.amount_cents, purchase.plan.currency)}
                  {purchase.plan.currency !== 'BRL' && (
                    <small>{formatMoney(item.amount_brl_cents)}</small>
                  )}
                </td>
                <td>
                  {item.statement_id && item.due_date ? (
                    <a
                      href={`/cartao?${new URLSearchParams({ account: purchase.plan.account_id, statement: item.statement_id })}`}
                    >
                      {humanDate(item.due_date)}
                    </a>
                  ) : (
                    'Sem vínculo'
                  )}
                </td>
                <td>{item.note}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </>
  );
}
