import type { Account, Category, Transaction, Tag } from '../../shared/types';
import { formatMoney, parseMoney } from '../../shared/money';
import { Badge, Button, CategoryOptions, InstallmentLink } from './index';
import { SplitDetails } from './SplitTransaction';
import { SpreadsheetCell } from './SpreadsheetCell';
import { api, humanDate } from '../api';
export function TransactionRow({
  t,
  accounts,
  categories,
  tags,
  onSaved,
  onRecurring,
  onSplit,
}: {
  t: Transaction;
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  onSaved: () => Promise<void>;
  onRecurring: (t: Transaction) => void;
  onSplit: (t: Transaction) => void;
}) {
  const account = accounts.find((a) => a.id === t.account_id);
  const financialLock =
    t.origin === 'imported'
      ? 'Importada: valor total e data protegidos. Classificação editável.'
      : t.kind !== 'regular' || t.origin !== 'manual'
        ? 'Lançamento de sistema: valores protegidos.'
        : t.split_count
          ? 'Desfaça a divisão para alterar os valores.'
          : account?.closed_at || account?.archived
            ? 'Conta encerrada.'
            : t.statement_status && t.statement_status !== 'open'
              ? 'Fatura fechada: valores protegidos.'
              : undefined;
  const categoryLock =
    t.kind === 'card_payment' || (t.origin === 'adjustment' && t.statement_id)
      ? 'Categoria de sistema protegida.'
      : undefined;
  const tagEditable =
    !t.split_count &&
    (t.origin === 'imported' ||
      (t.origin === 'manual' && t.kind === 'regular'));
  const canSplit =
    ['regular', 'installment'].includes(t.kind) &&
    t.origin !== 'adjustment' &&
    !t.advance_id;
  async function patch(body: object) {
    await api(`/transactions/${t.id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    await onSaved();
  }
  const categoryEditor = (
    draft: string,
    change: (value: string, immediate?: boolean) => void,
  ) => (
    <select
      aria-label={`Categoria de ${t.payee}`}
      value={draft}
      onChange={(e) => change(e.target.value, true)}
    >
      <option value="">Sem categoria</option>
      <CategoryOptions categories={categories} />
    </select>
  );
  const noteTags = JSON.stringify({
    note: t.note,
    tag_ids: t.tags.map((tag) => tag.id),
  });
  return (
    <tr data-transaction-id={t.id}>
      <SpreadsheetCell
        column={0}
        label={`Data de ${t.payee}`}
        value={t.date}
        display={humanDate(t.date)}
        locked={financialLock}
        save={(date) => patch({ date })}
        editor={(draft, change) => (
          <input
            aria-label={`Data de ${t.payee}`}
            type="date"
            required
            value={draft}
            onChange={(e) => change(e.target.value)}
          />
        )}
      />
      <SpreadsheetCell
        column={1}
        label={`Conta de ${t.payee}`}
        value={t.account_id}
        display={t.account_name}
        locked={financialLock}
        save={(account_id) => patch({ account_id })}
        editor={(draft, change) => (
          <select
            aria-label={`Conta de ${t.payee}`}
            value={draft}
            onChange={(e) => change(e.target.value, true)}
          >
            {accounts
              .filter(
                (a) =>
                  a.id === draft ||
                  (!a.closed_at && !a.archived && a.cutoff_date),
              )
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        )}
      />
      <SpreadsheetCell
        column={2}
        label={`Beneficiário de ${t.payee}`}
        value={t.payee}
        locked={financialLock}
        display={
          <>
            {t.payee}
            <InstallmentLink item={t} />
            {!!t.split_count && (
              <SplitDetails
                refresh={t}
                id={t.id}
                categories={categories}
                currency={t.currency}
              />
            )}
            {!!t.retroactive && <small>Retroativa: antes do corte</small>}
            {!!t.added_to_closed && <small>Incluída após o fechamento</small>}
          </>
        }
        save={(payee) => patch({ payee })}
        editor={(draft, change) => (
          <input
            aria-label={`Beneficiário de ${t.payee}`}
            required
            maxLength={200}
            value={draft}
            onChange={(e) => change(e.target.value)}
          />
        )}
      />
      <SpreadsheetCell
        column={3}
        label={`Valor de ${t.payee}`}
        value={JSON.stringify({
          amount: String(t.amount_cents / 100).replace('.', ','),
          rate: String(t.fx_rate),
        })}
        locked={financialLock}
        display={
          <>
            <span className="direction">
              {t.amount_cents < 0 ? 'Entrada (+)' : 'Saída (−)'}
            </span>
            {formatMoney(Math.abs(t.amount_cents), t.currency)}
            {t.currency !== 'BRL' && (
              <small>
                {formatMoney(Math.abs(t.amount_brl_cents))} · Cotação{' '}
                {t.fx_rate}
              </small>
            )}
          </>
        }
        save={(value) => {
          const v = JSON.parse(value);
          return patch({
            amount_cents: parseMoney(v.amount),
            ...(v.rate !== String(t.fx_rate)
              ? { fx_rate: Number(v.rate.replace(',', '.')) }
              : {}),
          });
        }}
        editor={(draft, change) => {
          const v = JSON.parse(draft);
          return (
            <>
              <label>
                Valor ({t.currency})
                <input
                  required
                  aria-label={`Valor (${t.currency})`}
                  inputMode="decimal"
                  value={v.amount}
                  onChange={(e) =>
                    change(JSON.stringify({ ...v, amount: e.target.value }))
                  }
                />
              </label>
              {t.currency !== 'BRL' && (
                <label>
                  Cotação manual
                  <input
                    inputMode="decimal"
                    value={v.rate}
                    onChange={(e) =>
                      change(JSON.stringify({ ...v, rate: e.target.value }))
                    }
                  />
                </label>
              )}
              <small>Negativo para entrada.</small>
            </>
          );
        }}
      />
      <SpreadsheetCell
        column={4}
        label={`Categoria de ${t.payee}`}
        value={t.category_id ?? ''}
        locked={categoryLock}
        display={
          t.split_count
            ? `Dividida em ${t.split_count} partes`
            : (categories.find((c) => c.id === t.category_id)?.name ??
              'Sem categoria')
        }
        open={t.split_count ? () => onSplit(t) : undefined}
        save={(category_id) => patch({ category_id: category_id || null })}
        editor={categoryEditor}
      />
      <SpreadsheetCell
        column={5}
        label={`Alocação de ${t.payee}`}
        value={t.category_id ?? ''}
        locked={categoryLock}
        display={
          t.split_count ? 'Por parte' : (t.allocation_name ?? 'Sem alocação')
        }
        open={t.split_count ? () => onSplit(t) : undefined}
        save={(category_id) => patch({ category_id: category_id || null })}
        editor={(draft, change) => (
          <>
            <small>A alocação acompanha a categoria escolhida.</small>
            {categoryEditor(draft, change)}
          </>
        )}
      />
      <SpreadsheetCell
        column={6}
        label={`Notas e tags de ${t.payee}`}
        value={noteTags}
        display={
          <>
            {t.note}
            {!t.split_count &&
              t.tags.map((tag) => (
                <span className="badge" key={tag.id}>
                  {tag.name}
                </span>
              ))}
          </>
        }
        save={(value) => {
          const v = JSON.parse(value);
          return patch({
            note: v.note,
            ...(JSON.stringify(v.tag_ids) !==
            JSON.stringify(t.tags.map((tag) => tag.id))
              ? { tag_ids: v.tag_ids }
              : {}),
          });
        }}
        editor={(draft, change) => {
          const v = JSON.parse(draft) as { note: string; tag_ids: string[] };
          return (
            <>
              <input
                aria-label={`Nota de ${t.payee}`}
                maxLength={2000}
                value={v.note}
                onChange={(e) =>
                  change(JSON.stringify({ ...v, note: e.target.value }))
                }
              />
              {tagEditable &&
                tags.map((tag) => (
                  <label className="tag-choice" key={tag.id}>
                    <input
                      type="checkbox"
                      checked={v.tag_ids.includes(tag.id)}
                      onChange={(e) =>
                        change(
                          JSON.stringify({
                            ...v,
                            tag_ids: e.target.checked
                              ? [...v.tag_ids, tag.id]
                              : v.tag_ids.filter((id) => id !== tag.id),
                          }),
                        )
                      }
                    />
                    {tag.name}
                  </label>
                ))}
              {!tagEditable && <small>Tags protegidas neste lançamento.</small>}
            </>
          );
        }}
      />
      <SpreadsheetCell
        column={7}
        label={`Origem de ${t.payee}`}
        value={t.origin}
        locked="Origem definida pelo sistema."
        display={
          <>
            <Badge origin={t.origin} />
            <small>Origem de sistema</small>
            {t.origin === 'imported' && (
              <small>Categoria, nota, tags e divisão editáveis.</small>
            )}
          </>
        }
      />
      <td>
        {canSplit && (
          <Button onClick={() => onSplit(t)}>
            {t.split_count ? 'Editar divisão' : 'Dividir transação'}
          </Button>
        )}
        {t.kind === 'regular' && t.origin !== 'adjustment' && (
          <Button onClick={() => onRecurring(t)}>Criar recorrente</Button>
        )}
      </td>
    </tr>
  );
}
