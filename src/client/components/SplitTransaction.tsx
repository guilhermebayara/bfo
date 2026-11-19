import { useEffect, useState } from 'react';
import type {
  Category,
  Tag,
  Transaction,
  TransactionSplit,
} from '../../shared/types';
import { formatMoney, parseMoney } from '../../shared/money';
import { splitAmounts } from '../../shared/splits';
import { api } from '../api';
import { Button, Modal } from './index';
import { CategoryPicker } from './CategoryPicker';
type Part = {
  value: string;
  category_id: string;
  note: string;
  tag_ids: string[];
};
const empty = (): Part => ({
  value: '',
  category_id: '',
  note: '',
  tag_ids: [],
});
export function SplitTransaction({
  transaction: t,
  categories,
  tags,
  onSaved,
  onClose,
}: {
  transaction: Transaction;
  categories: Category[];
  tags: Tag[];
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState('amount'),
    [parts, setParts] = useState<Part[]>([empty(), empty()]),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    api<TransactionSplit[]>(`/transactions/${t.id}/splits`, {
      signal: abort.signal,
    })
      .then((rows) => {
        if (rows.length)
          setParts(
            rows.map((p) => ({
              value: String(Math.abs(p.amount_cents) / 100).replace('.', ','),
              category_id: p.category_id ?? '',
              note: p.note,
              tag_ids: p.tags.map((t) => t.id),
            })),
          );
        setLoading(false);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [t.id]);
  const values = parts.map((p) => {
    try {
      return parseMoney(p.value);
    } catch {
      return 0;
    }
  });
  const remaining =
    (mode === 'percent' ? 10000 : Math.abs(t.amount_cents)) -
    values.reduce((a, b) => a + b, 0);
  let valid = false,
    amounts: number[] = [];
  try {
    amounts = splitAmounts(t.amount_cents, mode, values);
    valid = true;
  } catch {}
  function change(i: number, patch: Partial<Part>) {
    setParts(parts.map((p, n) => (n === i ? { ...p, ...patch } : p)));
  }
  async function save(remove = false) {
    setBusy(true);
    setError('');
    try {
      await api(`/transactions/${t.id}/splits`, {
        method: remove ? 'DELETE' : 'PUT',
        body: JSON.stringify(
          remove
            ? {}
            : {
                mode,
                expected_amount_cents: t.amount_cents,
                parts: parts.map((p, i) => ({
                  ...p,
                  value: values[i],
                  category_id: p.category_id || null,
                })),
              },
        ),
      });
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Dividir ${t.payee}`} onClose={onClose} busy={busy}>
      <p>
        {formatMoney(t.amount_cents, t.currency)} ·{' '}
        {t.date.split('-').reverse().join('/')}. Valor e data pertencem à
        transação original.
      </p>
      {t.origin === 'imported' && (
        <p>Importada: valor e data permanecem travados.</p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy || loading}>
          <label>
            Dividir por
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setParts(parts.map((p) => ({ ...p, value: '' })));
              }}
            >
              <option value="amount">Valor</option>
              <option value="percent">Percentual</option>
            </select>
          </label>
          {parts.map((p, i) => (
            <fieldset key={i}>
              <legend>Parte {i + 1}</legend>
              <label>
                {mode === 'percent'
                  ? 'Percentual (%)'
                  : `Valor (${t.currency})`}
                <input
                  required
                  inputMode="decimal"
                  value={p.value}
                  onChange={(e) => change(i, { value: e.target.value })}
                />
              </label>
              <CategoryPicker
                label={`Categoria da parte ${i + 1}`}
                categories={categories}
                value={p.category_id}
                onChange={(category_id) => change(i, { category_id })}
              />
              <label>
                Nota da parte {i + 1}
                <input
                  maxLength={2000}
                  value={p.note}
                  onChange={(e) => change(i, { note: e.target.value })}
                />
              </label>
              <fieldset className="tag-list">
                <legend>Tags da parte {i + 1}</legend>
                {tags.map((tag) => (
                  <label key={tag.id}>
                    <input
                      type="checkbox"
                      checked={p.tag_ids.includes(tag.id)}
                      onChange={(e) =>
                        change(i, {
                          tag_ids: e.target.checked
                            ? [...p.tag_ids, tag.id]
                            : p.tag_ids.filter((id) => id !== tag.id),
                        })
                      }
                    />
                    {tag.name}
                  </label>
                ))}
              </fieldset>
              {valid && <p>{formatMoney(amounts[i], t.currency)}</p>}
              <Button
                type="button"
                disabled={parts.length <= 2}
                onClick={() => setParts(parts.filter((_, n) => n !== i))}
              >
                Remover parte {i + 1}
              </Button>
            </fieldset>
          ))}
          <p role="status">
            Falta dividir:{' '}
            {mode === 'percent'
              ? `${(remaining / 100).toFixed(2).replace('.', ',')}%`
              : formatMoney(remaining, t.currency)}
          </p>
          <Button
            type="button"
            disabled={parts.length >= 50}
            onClick={() => setParts([...parts, empty()])}
          >
            Adicionar parte
          </Button>
          <Button type="submit" disabled={!valid}>
            Salvar divisão
          </Button>
          {!!t.split_count && (
            <Button type="button" onClick={() => void save(true)}>
              Desfazer divisão
            </Button>
          )}
        </fieldset>
        <p role="alert">{error}</p>
      </form>
    </Modal>
  );
}
export function SplitDetails({
  id,
  categories,
  currency,
  refresh,
}: {
  id: string;
  categories: Category[];
  currency: string;
  refresh?: unknown;
}) {
  const [parts, setParts] = useState<TransactionSplit[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    api<TransactionSplit[]>(`/transactions/${id}/splits`, {
      signal: abort.signal,
    })
      .then(setParts)
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [id, refresh]);
  return (
    <>
      <small role="alert">{error}</small>
      {parts.map((p, i) => (
        <div key={p.id}>
          Parte {i + 1}: {formatMoney(p.amount_cents, currency)} ·{' '}
          {categories.find((c) => c.id === p.category_id)?.name ??
            'Sem categoria'}{' '}
          · {p.note}{' '}
          {p.tags.map((t) => (
            <span className="badge" key={t.id}>
              {t.name}
            </span>
          ))}
        </div>
      ))}
    </>
  );
}
