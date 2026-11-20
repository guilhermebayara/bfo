import { useEffect, useState } from 'react';
import type {
  TransactionHistory as History,
  TransactionSnapshot,
} from '../../server/transaction-history';
import { transactionFieldLabels as fields } from '../../shared/transaction-notice';
import { formatMoney } from '../../shared/money';
import type { Account, Category, Tag, Transaction } from '../../shared/types';
import { api, humanDate } from '../api';
import { Button, Modal, State } from './index';

export function TransactionHistory({
  transaction,
  accounts,
  categories,
  tags,
  onClose,
  onSaved,
}: {
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [entries, setEntries] = useState<History[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const path = '/transactions/' + encodeURIComponent(transaction.id);
  useEffect(() => {
    api<History[]>(path + '/history')
      .then(setEntries)
      .catch((e) => setError(e.message));
  }, [path]);

  function value(field: string, snapshot: TransactionSnapshot) {
    const v = snapshot[field];
    if (v === null || v === '') return 'Sem valor';
    if (field === 'date') return humanDate(String(v));
    if (field === 'amount_cents')
      return formatMoney(Number(v), String(snapshot.currency));
    if (field === 'amount_brl_cents') return formatMoney(Number(v));
    if (field === 'account_id')
      return accounts.find((a) => a.id === v)?.name ?? String(v);
    if (field === 'category_id')
      return categories.find((a) => a.id === v)?.name ?? String(v);
    const tagNames = (ids: string[]) =>
      ids.map((id) => tags.find((tag) => tag.id === id)?.name ?? id).join(', ');
    if (field === 'tag_ids') return tagNames(snapshot.tag_ids) || 'Sem tags';
    if (field === 'splits')
      return (
        snapshot.splits
          .map((p) =>
            [
              formatMoney(p.amount_cents, String(snapshot.currency)),
              categories.find((c) => c.id === p.category_id)?.name,
              p.note,
              tagNames(p.tag_ids),
            ]
              .filter(Boolean)
              .join(' · '),
          )
          .join(' / ') || 'Sem divisão'
      );
    if (field === 'cancellation')
      return snapshot.cancellation?.reason ?? 'Sem cancelamento';
    return String(v);
  }

  async function restore(action_id: string, field: string) {
    setBusy(true);
    setError('');
    try {
      await api(path + '/restore-field', {
        method: 'POST',
        body: JSON.stringify({ action_id, field }),
      });
      setEntries(await api<History[]>(path + '/history'));
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function canRestore(field: string) {
    if (field === 'note' || field === 'recurring_id' || field === 'splits')
      return true;
    if (field === 'category_id')
      return (
        transaction.kind !== 'card_payment' &&
        !(transaction.origin === 'adjustment' && transaction.statement_id)
      );
    if (field === 'tag_ids') return transaction.origin !== 'adjustment';
    if (
      transaction.origin !== 'manual' ||
      (transaction.statement_status && transaction.statement_status !== 'open')
    )
      return false;
    if (field === 'statement_id')
      return (
        !transaction.advance_id &&
        ['regular', 'installment'].includes(transaction.kind)
      );
    if (transaction.kind === 'installment' && transaction.installment_number)
      return ['date', 'amount_cents', 'payee'].includes(field);
    return (
      transaction.kind === 'regular' &&
      ['date', 'account_id', 'amount_cents', 'payee', 'fx_rate'].includes(field)
    );
  }

  return (
    <Modal title="Histórico de alterações" onClose={onClose} busy={busy}>
      <p>{transaction.payee}</p>
      {error && <State kind="error">{error}</State>}
      {!entries && !error && (
        <State kind="loading">Carregando histórico…</State>
      )}
      {entries?.length === 0 && (
        <State kind="empty">Nenhuma alteração registrada.</State>
      )}
      {entries?.map((entry) => (
        <section className="panel" key={entry.id}>
          <h3>
            {new Date(entry.created_at).toLocaleString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
            })}{' '}
            · {entry.source}
          </h3>
          {entry.changes.map(({ transaction_id, before, after }) => (
            <div key={transaction_id}>
              <p>
                <strong>{(after ?? before)?.payee}</strong>
                {' · '}
                {before && after ? 'Edição' : before ? 'Exclusão' : 'Criação'}
              </p>
              <ul>
                {Object.entries(fields)
                  .filter(([field]) =>
                    before && after
                      ? JSON.stringify(before[field]) !==
                        JSON.stringify(after[field])
                      : [
                          'date',
                          'account_id',
                          'amount_cents',
                          'category_id',
                          'note',
                          'tag_ids',
                          'splits',
                        ].includes(field),
                  )
                  .map(([field, label]) => (
                    <li key={field}>
                      {label}
                      {' · '}
                      {before && (
                        <>
                          {value(field, before)}
                          {after && ' → '}
                        </>
                      )}
                      {after && value(field, after)}
                      {before &&
                        transaction_id === transaction.id &&
                        canRestore(field) && (
                          <Button
                            variant="quiet"
                            disabled={busy}
                            onClick={() => void restore(entry.id, field)}
                          >
                            Voltar {label.toLocaleLowerCase('pt-BR')}
                          </Button>
                        )}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </Modal>
  );
}
