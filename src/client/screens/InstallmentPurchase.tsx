import { useEffect, useState } from 'react';
import type {
  Account,
  InstallmentPlan,
  Transaction,
  InstallmentAdvance,
} from '../../shared/types';
import { formatMoney, parseMoney } from '../../shared/money';
import { api, humanDate } from '../api';
import { Button, Table } from '../components';
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
    | 'retroactive'
    | 'added_to_closed'
    | 'advance_id'
  > & {
    cancelled_reason: string | null;
    statement_id: string | null;
    due_date: string | null;
    closing_date: string | null;
    status: string | null;
  })[];
  advances: InstallmentAdvance[];
  real_cost_cents: number;
  current_closing_date: string;
};
export function InstallmentPurchase({
  id,
  accounts,
  onSaved,
}: {
  id: string;
  accounts: Account[];
  onSaved: () => Promise<void>;
}) {
  const [purchase, setPurchase] = useState<Purchase | null>(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [count, setCount] = useState('1'),
    [paid, setPaid] = useState(''),
    [rate, setRate] = useState(''),
    [busy, setBusy] = useState(false);
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
  }, [id, revision]);
  if (!purchase)
    return (
      <>
        <h1>Compra parcelada</h1>
        <p role="status">{error || 'Carregando compra…'}</p>
      </>
    );
  const { plan } = purchase,
    money = (n: number) => formatMoney(n, plan.currency);
  const future = purchase.installments.filter(
    (t) =>
      t.installment_number &&
      !t.advance_id &&
      !t.cancelled_reason &&
      t.status === 'open' &&
      t.closing_date! > purchase.current_closing_date,
  );
  const selected = future.slice(0, Number(count)),
    face = selected.reduce((sum, t) => sum + t.amount_cents, 0);
  let discount: number | null = null;
  try {
    discount = face - parseMoney(paid);
  } catch {}
  async function advance(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/installment-plans/${id}/advance`, {
        method: 'POST',
        body: JSON.stringify({
          count: Number(count),
          paid_cents: parseMoney(paid),
          expected_face_cents: face,
          ...(rate ? { fx_rate: Number(rate.replace(',', '.')) } : {}),
        }),
      });
      await onSaved();
      setPaid('');
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <a href="/transacoes">Voltar a Transações</a>
      <h1>Compra parcelada</h1>
      <h2>{plan.description}</h2>
      <p>
        {accounts.find((a) => a.id === plan.account_id)?.name} ·{' '}
        {humanDate(plan.first_date)} · {money(plan.total_cents)} em {plan.count}{' '}
        parcelas
      </p>
      <p>Custo real: {money(purchase.real_cost_cents)}</p>
      {future.length > 0 && (
        <section>
          <h2>Antecipar parcelas</h2>
          <form onSubmit={advance}>
            <fieldset disabled={busy}>
              <label>
                Quantidade de parcelas a antecipar
                <input
                  required
                  type="number"
                  min="1"
                  max={future.length}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </label>
              <p>
                São antecipadas as próximas parcelas futuras abertas, na ordem.
                Valor cheio: {money(face)}
              </p>
              <label>
                Valor cobrado pelo banco ({plan.currency})
                <input
                  required
                  inputMode="decimal"
                  value={paid}
                  onChange={(e) => setPaid(e.target.value)}
                />
              </label>
              {plan.currency !== 'BRL' && (
                <label>
                  Cotação para BRL (opcional)
                  <input
                    inputMode="decimal"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                  />
                </label>
              )}
              <p>
                Desconto:{' '}
                {discount === null
                  ? 'Preencha o valor cobrado'
                  : money(discount)}
              </p>
              <Button
                type="submit"
                disabled={
                  discount === null ||
                  discount < 0 ||
                  discount > face ||
                  Number(count) < 1 ||
                  Number(count) > future.length
                }
              >
                Registrar antecipação
              </Button>
            </fieldset>
          </form>
        </section>
      )}
      <p role="alert">{error}</p>
      <Table
        label="Parcelas da compra"
        headers={['Parcela', 'Data', 'Valor', 'Fatura', 'Marcação / Nota']}
      >
        {purchase.installments.map((t) => (
          <tr key={t.id}>
            <td>
              {t.installment_number
                ? `${t.installment_number}/${plan.count}`
                : 'Antecipação'}
            </td>
            <td>{humanDate(t.date)}</td>
            <td>
              {money(t.amount_cents)}
              {plan.currency !== 'BRL' && (
                <small>{formatMoney(t.amount_brl_cents)}</small>
              )}
            </td>
            <td>
              {t.cancelled_reason ? (
                'Cancelada: ' + t.cancelled_reason
              ) : t.advance_id && t.installment_number ? (
                'Antecipada'
              ) : t.statement_id && t.due_date ? (
                <a
                  href={`/cartao?${new URLSearchParams({ account: plan.account_id, statement: t.statement_id })}`}
                >
                  {humanDate(t.due_date)}
                </a>
              ) : (
                'Sem vínculo'
              )}
            </td>
            <td>
              {!!t.retroactive && <small>Retroativa: antes do corte</small>}
              {!!t.added_to_closed && <small>Incluída após o fechamento</small>}
              {t.note}
            </td>
          </tr>
        ))}
      </Table>
      <h2>Histórico de antecipações</h2>
      {purchase.advances.length ? (
        <Table
          label="Histórico de antecipações"
          headers={[
            'Data',
            'Parcelas',
            'Valor cheio',
            'Valor pago',
            'Desconto',
          ]}
        >
          {purchase.advances.map((a) => (
            <tr key={a.id}>
              <td>{humanDate(a.created_at.slice(0, 10))}</td>
              <td>{a.count}</td>
              <td>{money(a.face_cents)}</td>
              <td>{money(a.paid_cents)}</td>
              <td>{money(a.face_cents - a.paid_cents)}</td>
            </tr>
          ))}
        </Table>
      ) : (
        <p>Nenhuma antecipação registrada.</p>
      )}
    </>
  );
}
