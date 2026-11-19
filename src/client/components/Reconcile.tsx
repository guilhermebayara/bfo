import { useState, type FormEvent } from 'react';
import type { Account } from '../../shared/types';
import { formatMoney, parseMoney } from '../../shared/money';
import { api } from '../api';
import { Button, Modal } from './index';
type Preview = {
  app_balance_cents: number;
  bank_balance_cents: number;
  adjustment_cents: number;
};
export function Reconcile({
  account,
  onClose,
  onSaved,
}: {
  account: Account;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [balance, setBalance] = useState('');
  const [rate, setRate] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = {
        bank_balance_cents: parseMoney(balance),
        ...(rate ? { fx_rate: Number(rate.replace(',', '.')) } : {}),
      };
      if (!preview)
        setPreview(
          await api<Preview>(`/accounts/${account.id}/reconcile`, {
            method: 'POST',
            body: JSON.stringify(body),
          }),
        );
      else {
        await api(`/accounts/${account.id}/reconcile`, {
          method: 'POST',
          body: JSON.stringify({
            ...body,
            confirm: true,
            expected_balance_cents: preview.app_balance_cents,
          }),
        });
        await onSaved();
        onClose();
      }
    } catch (e) {
      setError((e as Error).message);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Conferir saldo: ${account.name}`}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            Saldo do banco ({account.currency})
            <input
              required
              inputMode="decimal"
              value={balance}
              onChange={(e) => {
                setBalance(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          {account.currency !== 'BRL' && (
            <label>
              Cotação manual (opcional)
              <input
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
              <small>
                PTAX automática. Se indisponível, informe a cotação para
                registrar o ajuste em reais.
              </small>
            </label>
          )}
          {preview && (
            <section className="preview">
              <p>
                Saldo no app:{' '}
                {formatMoney(preview.app_balance_cents, account.currency)}
              </p>
              <p>
                Saldo informado:{' '}
                {formatMoney(preview.bank_balance_cents, account.currency)}
              </p>
              <p>
                Ajuste visível:{' '}
                {formatMoney(
                  Math.abs(preview.adjustment_cents),
                  account.currency,
                )}{' '}
                (
                {preview.adjustment_cents > 0
                  ? 'saída'
                  : preview.adjustment_cents < 0
                    ? 'entrada'
                    : 'sem diferença'}
                )
              </p>
              <Button
                type="button"
                onClick={() => {
                  location.href = `/transacoes?account=${account.id}`;
                }}
              >
                Procurar o que faltou
              </Button>
            </section>
          )}
          <Button type="submit">
            {preview
              ? preview.adjustment_cents
                ? 'Lançar ajuste e conferir'
                : 'Confirmar saldo sem ajuste'
              : 'Ver diferença'}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancelar
          </Button>
        </fieldset>
        <p role="alert">{error}</p>
      </form>
    </Modal>
  );
}
