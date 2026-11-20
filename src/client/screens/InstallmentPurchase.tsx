import { useEffect, useState } from 'react';
import type {
  Account,
  InstallmentPlan,
  Transaction,
  InstallmentAdvance,
} from '../../shared/types';
import { formatMoney, parseMoney } from '../../shared/money';
import { api, humanDate } from '../api';
import { Badge, PageHeader, Panel, State, Button, Table } from '../components';
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
        <PageHeader
          title="Compra parcelada"
          actions={
            <a className="action-link" href="/transacoes">
              Voltar a Transações
            </a>
          }
        />
        {error ? (
          <State kind="error">{error}</State>
        ) : (
          <State kind="loading">Carregando compra…</State>
        )}
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
      <PageHeader
        title="Compra parcelada"
        context={accounts.find((a) => a.id === plan.account_id)?.name}
        actions={
          <>
            <a className="action-link" href="/transacoes">
              Voltar a Transações
            </a>
            {!!future.length && (
              <a
                className="action-link button button-primary"
                href="#antecipar-parcelas"
              >
                Antecipar parcelas
              </a>
            )}
          </>
        }
      />
      <Panel className="purchase-overview">
        <div className="section-heading">
          <h2>{plan.description}</h2>
          <div className="section-total">
            Custo real: <strong>{money(purchase.real_cost_cents)}</strong>
          </div>
        </div>
        <p>
          {humanDate(plan.first_date)} · {money(plan.total_cents)} em{' '}
          {plan.count} parcelas
        </p>
      </Panel>
      {error && <State kind="error">{error}</State>}
      <Panel className="account-group">
        <h2>Parcelas da compra</h2>
        <Table
          label="Parcelas da compra"
          numeric={[2]}
          widths={['13%', '15%', '18%', '22%', '32%']}
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
              <td className="numeric">
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
                {!!t.retroactive && (
                  <small>
                    <Badge state="retroactive" />: antes do corte
                  </small>
                )}
                {!!t.added_to_closed && (
                  <small>Incluída após o fechamento</small>
                )}
                {t.note}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
      {future.length > 0 && (
        <Panel
          id="antecipar-parcelas"
          className="account-group purchase-advance"
          tabIndex={-1}
        >
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
                variant="primary"
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
        </Panel>
      )}
      <Panel className="account-group">
        <h2>Histórico de antecipações</h2>
        {purchase.advances.length ? (
          <Table
            label="Histórico de antecipações"
            numeric={[1, 2, 3, 4]}
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
                <td className="numeric">{a.count}</td>
                <td className="numeric">{money(a.face_cents)}</td>
                <td className="numeric">{money(a.paid_cents)}</td>
                <td className="numeric">
                  {money(a.face_cents - a.paid_cents)}
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <State kind="empty">Nenhuma antecipação registrada.</State>
        )}
      </Panel>
    </>
  );
}
