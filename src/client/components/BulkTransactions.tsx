import { useEffect, useState } from 'react';
import type { Category, Recurring, Tag, Transaction } from '../../shared/types';
import { formatMoney, roundRatio } from '../../shared/money';
import { api } from '../api';
import { Button, CategoryOptions } from './index';
export function BulkTransactions({
  items,
  categories,
  tags,
  onSaved,
  onClear,
}: {
  items: Transaction[];
  categories: Category[];
  tags: Tag[];
  onSaved: () => Promise<void>;
  onClear: () => void;
}) {
  const [field, setField] = useState('category_id'),
    [value, setValue] = useState(''),
    [add, setAdd] = useState<string[]>([]),
    [remove, setRemove] = useState<string[]>([]),
    [recurring, setRecurring] = useState<Recurring[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false);
  useEffect(() => {
    api<{ items: Recurring[] }>('/recurring?catalog=1')
      .then((r) => setRecurring(r.items))
      .catch((e) => setError(e.message));
  }, []);
  const protectedFinancial = items.some(
    (t) =>
      t.origin !== 'manual' ||
      t.kind !== 'regular' ||
      t.split_count ||
      (t.statement_status && t.statement_status !== 'open'),
  );
  const financialItems = items.filter((t) => t.kind !== 'transfer');
  const transferred = items
    .filter((t) => t.kind === 'transfer')
    .reduce((sum, t) => sum + Math.abs(t.amount_brl_cents), 0);
  const total = financialItems.reduce(
    (sum, t) => sum + (t.kind === 'transfer' ? 0 : t.amount_brl_cents),
    0,
  );
  async function save(removeItems = false) {
    setBusy(true);
    setError('');
    try {
      await api('/transactions/batch', {
        method: 'POST',
        body: JSON.stringify({
          ids: items.map((t) => t.id),
          ...(removeItems
            ? { delete: true }
            : field === 'tags'
              ? { add_tag_ids: add, remove_tag_ids: remove }
              : field === 'recurring_id'
                ? { recurring_id: value || null }
                : {
                    changes: {
                      [field]: field === 'category_id' ? value || null : value,
                    },
                  }),
        }),
      });
      await onSaved();
      onClear();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="bulk-panel notice" aria-label="Seleção múltipla">
      <div className="toolbar">
        <strong>{items.length} selecionadas</strong>
        <span>
          Total: {formatMoney(-total)} · Média:{' '}
          {formatMoney(
            -roundRatio(
              BigInt(total),
              BigInt(Math.max(1, financialItems.length)),
            ),
          )}
        </span>
        <Button onClick={onClear}>Limpar seleção</Button>
      </div>
      {!!transferred && <p>Valor transferido: {formatMoney(transferred)}</p>}
      <small>
        Valores em reais. Transferências ficam fora do total e da média
        financeira.
      </small>
      <fieldset disabled={busy} className="filters">
        <label>
          Editar em lote
          <select
            value={field}
            onChange={(e) => {
              setField(e.target.value);
              setValue('');
            }}
          >
            <option value="category_id">Categoria</option>
            <option value="note">Nota</option>
            <option value="tags">Adicionar e remover tags</option>
            <option value="recurring_id">Ligar a um recorrente</option>
            <option value="date" disabled={!!protectedFinancial}>
              Data
            </option>
            <option value="payee" disabled={!!protectedFinancial}>
              Beneficiário
            </option>
          </select>
        </label>
        {field === 'category_id' ? (
          <label>
            Nova categoria
            <select value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">Sem categoria</option>
              <CategoryOptions categories={categories} />
            </select>
          </label>
        ) : field === 'recurring_id' ? (
          <label>
            Recorrente
            <select value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">Desligar do recorrente</option>
              {recurring.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.payee} · {r.account_name}
                </option>
              ))}
            </select>
          </label>
        ) : field === 'tags' ? (
          <>
            {tags.map((t) => (
              <div key={t.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={add.includes(t.id)}
                    onChange={(e) => {
                      setAdd(
                        e.target.checked
                          ? [...add, t.id]
                          : add.filter((id) => id !== t.id),
                      );
                      setRemove(remove.filter((id) => id !== t.id));
                    }}
                  />
                  Adicionar {t.name}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={remove.includes(t.id)}
                    onChange={(e) => {
                      setRemove(
                        e.target.checked
                          ? [...remove, t.id]
                          : remove.filter((id) => id !== t.id),
                      );
                      setAdd(add.filter((id) => id !== t.id));
                    }}
                  />
                  Remover {t.name}
                </label>
              </div>
            ))}
          </>
        ) : (
          <label>
            {field === 'date'
              ? 'Nova data'
              : field === 'note'
                ? 'Nova nota'
                : 'Novo beneficiário'}
            <input
              type={field === 'date' ? 'date' : 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
        )}
        <Button onClick={() => void save()}>Aplicar aos selecionados</Button>
        <Button
          disabled={!!protectedFinancial}
          onClick={() => setDeleting(true)}
        >
          Excluir selecionados
        </Button>
      </fieldset>
      {protectedFinancial && (
        <small>
          Seleção com campos protegidos: apenas classificação disponível.
        </small>
      )}
      {deleting && (
        <div className="notice">
          Excluir {items.length} transações?{' '}
          <Button disabled={busy} onClick={() => void save(true)}>
            Confirmar exclusão
          </Button>
          <Button disabled={busy} onClick={() => setDeleting(false)}>
            Cancelar exclusão
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
