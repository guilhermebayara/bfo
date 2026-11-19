import { useState } from 'react';
import type { Account, Category, Transaction, Tag } from '../../shared/types';
import { formatMoney, parseMoney } from '../../shared/money';
import { Badge, Button, InstallmentLink } from './index';
import { CategoryPicker } from './CategoryPicker';
import { api, humanDate } from '../api';
export function TransactionRow({
  t,
  accounts,
  categories,
  tags,
  onSaved,
  onRecurring,
}: {
  t: Transaction;
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  onSaved: () => Promise<void>;
  onRecurring: (t: Transaction) => void;
}) {
  const [edit, setEdit] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    date: t.date,
    account_id: t.account_id,
    payee: t.payee,
    amount: String(t.amount_cents / 100).replace('.', ','),
    category_id: t.category_id ?? '',
    note: t.note,
    tag_ids: t.tags.map((t) => t.id),
    fx_rate: String(t.fx_rate),
  });
  const all = t.origin === 'manual' && t.kind === 'regular';
  const locked =
    t.kind === 'card_payment' ||
    (t.origin === 'adjustment' && !!t.statement_id);
  const id = `edit-${t.id}`;
  const field = (name: keyof typeof draft, value: string) =>
    setDraft((d) => ({ ...d, [name]: value }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        note: draft.note,
        ...(!locked ? { category_id: draft.category_id || null } : {}),
      };
      if (all) {
        if (draft.date !== t.date) body.date = draft.date;
        if (draft.account_id !== t.account_id)
          body.account_id = draft.account_id;
        if (draft.payee !== t.payee) body.payee = draft.payee;
        const amount = parseMoney(draft.amount);
        if (amount !== t.amount_cents) body.amount_cents = amount;
        if (draft.fx_rate !== String(t.fx_rate))
          body.fx_rate = Number(draft.fx_rate.replace(',', '.'));
        if (
          JSON.stringify(draft.tag_ids) !==
          JSON.stringify(t.tags.map((t) => t.id))
        )
          body.tag_ids = draft.tag_ids;
      }
      await api(`/transactions/${t.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      await onSaved();
      setEdit(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const code =
    accounts.find((a) => a.id === draft.account_id)?.currency ?? t.currency;
  return (
    <tr>
      <td>
        {edit && all ? (
          <input
            aria-label={`Data de ${t.payee}`}
            form={id}
            required
            type="date"
            value={draft.date}
            disabled={busy}
            onChange={(e) => field('date', e.target.value)}
          />
        ) : (
          humanDate(t.date)
        )}
      </td>
      <td>
        {edit && all ? (
          <select
            aria-label={`Conta de ${t.payee}`}
            form={id}
            value={draft.account_id}
            disabled={busy}
            onChange={(e) => field('account_id', e.target.value)}
          >
            {accounts
              .filter(
                (a) =>
                  a.id === draft.account_id ||
                  (!a.closed_at && !a.archived && a.cutoff_date),
              )
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        ) : (
          t.account_name
        )}
      </td>
      <td>
        {edit && all ? (
          <input
            form={id}
            aria-label={`Beneficiário de ${t.payee}`}
            required
            value={draft.payee}
            disabled={busy}
            onChange={(e) => field('payee', e.target.value)}
          />
        ) : (
          t.payee
        )}
        <InstallmentLink item={t} />
      </td>
      <td>
        {edit && all ? (
          <>
            <label>
              Valor ({code})
              <input
                form={id}
                required
                inputMode="decimal"
                value={draft.amount}
                disabled={busy}
                onChange={(e) => field('amount', e.target.value)}
              />
            </label>
            {code !== 'BRL' && (
              <label>
                Cotação manual
                <input
                  form={id}
                  inputMode="decimal"
                  value={draft.fx_rate}
                  onChange={(e) => field('fx_rate', e.target.value)}
                />
              </label>
            )}
            <small>Negativo para entrada.</small>
          </>
        ) : (
          <>
            <span className="direction">
              {t.amount_cents < 0 ? 'Entrada (+)' : 'Saída (−)'}
            </span>
            {formatMoney(Math.abs(t.amount_cents), t.currency)}
            {t.currency !== 'BRL' && (
              <small>{formatMoney(Math.abs(t.amount_brl_cents))}</small>
            )}
          </>
        )}
      </td>
      <td>
        {edit && !locked ? (
          <CategoryPicker
            categories={categories}
            label={`Categoria de ${t.payee}`}
            value={draft.category_id}
            onChange={(v) => field('category_id', v)}
            disabled={busy}
          />
        ) : (
          (categories.find((c) => c.id === t.category_id)?.name ??
          'Sem categoria')
        )}
      </td>
      <td>{t.allocation_name ?? 'Sem alocação'}</td>
      <td>
        {edit ? (
          <input
            form={id}
            aria-label={`Nota de ${t.payee}`}
            maxLength={2000}
            value={draft.note}
            disabled={busy}
            onChange={(e) => field('note', e.target.value)}
          />
        ) : (
          t.note
        )}
        {edit && all
          ? tags.map((tag) => (
              <label className="tag-choice" key={tag.id}>
                <input
                  form={id}
                  type="checkbox"
                  checked={draft.tag_ids.includes(tag.id)}
                  disabled={busy}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      tag_ids: e.target.checked
                        ? [...d.tag_ids, tag.id]
                        : d.tag_ids.filter((v) => v !== tag.id),
                    }))
                  }
                />
                {tag.name}
              </label>
            ))
          : t.tags.map((tag) => (
              <span className="badge" key={tag.id}>
                {tag.name}
              </span>
            ))}
      </td>
      <td>
        <Badge origin={t.origin} />
        {t.origin === 'imported' && <small>Somente categoria e nota.</small>}
        {t.kind === 'installment' && <small>Parcela: categoria e nota.</small>}
      </td>
      <td>
        {edit ? (
          <form id={id} onSubmit={save}>
            <Button disabled={busy} type="submit">
              Salvar
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => setEdit(false)}
            >
              Cancelar
            </Button>
          </form>
        ) : (
          <>
            <Button onClick={() => setEdit(true)}>Editar {t.payee}</Button>
            {t.kind === 'regular' && t.origin !== 'adjustment' && (
              <Button onClick={() => onRecurring(t)}>Criar recorrente</Button>
            )}
          </>
        )}
        <small role="status">{error}</small>
      </td>
    </tr>
  );
}
