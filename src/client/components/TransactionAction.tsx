import { useState } from 'react';
import type { Transaction } from '../../shared/types';
import { api } from '../api';
import { Button, Modal } from './index';
export function TransactionAction({
  transaction,
  mode,
  onClose,
  onSaved,
}: {
  transaction: Transaction;
  mode: 'cancel-future' | 'move-statement';
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [reason, setReason] = useState(''),
    [direction, setDirection] = useState('next'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal
      title={
        mode === 'cancel-future'
          ? 'Cancelar parcelas futuras'
          : 'Mover de fatura'
      }
      onClose={onClose}
      busy={busy}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await api(`/transactions/${transaction.id}/${mode}`, {
              method: 'POST',
              body: JSON.stringify(
                mode === 'cancel-future' ? { reason } : { direction },
              ),
            });
            await onSaved();
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>{transaction.payee}</p>
        <fieldset disabled={busy}>
          {mode === 'cancel-future' ? (
            <>
              <p>
                Serão canceladas as parcelas após a{' '}
                {transaction.installment_number}/{transaction.installment_count}
                . A parcela selecionada permanece. Parcelas já antecipadas ficam
                no histórico.
              </p>
              <label>
                Motivo do cancelamento
                <input
                  required
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </>
          ) : (
            <label>
              Fatura de destino
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
              >
                <option value="previous">Anterior</option>
                <option value="next">Seguinte</option>
              </select>
            </label>
          )}
          <Button type="submit">
            {mode === 'cancel-future'
              ? 'Confirmar cancelamento'
              : 'Mover compra'}
          </Button>
        </fieldset>
        <p role="alert">{error}</p>
      </form>
    </Modal>
  );
}
