import { useState } from 'react';
import { Modal } from './index';
import { TransactionAction } from './TransactionAction';
import { StatementFromTable } from '../screens/Cards';
import { positionMenu } from './menu';
import type { Account, Category, Transaction, Tag } from '../../shared/types';
import { formatMoney, parseMoney } from '../../shared/money';
import { Badge, Button, CategoryOptions } from './index';
import { SpreadsheetCell } from './SpreadsheetCell';
import { AccountOptions } from './AccountOptions';
import { api, humanDate } from '../api';
export function TransactionRow({
  t,
  accounts,
  categories,
  tags,
  onSaved,
  onRecurring,
  onSplit,
  selected,
  onSelect,
  accountFilter,
}: {
  t: Transaction;
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  onSaved: () => Promise<void>;
  onRecurring: (t: Transaction) => void;
  onSplit: (t: Transaction) => void;
  selected: boolean;
  onSelect: () => void;
  accountFilter: string;
}) {
  const installment =
    t.kind === 'installment' &&
    !!t.installment_number &&
    !t.advance_id &&
    t.origin === 'manual';
  const [scope, setScope] = useState<{
    body: object;
    resolve: () => void;
    reject: (e: Error) => void;
  } | null>(null);
  const [scopeError, setScopeError] = useState('');
  const [scopeBusy, setScopeBusy] = useState(false);
  const [action, setAction] = useState<
    'cancel-future' | 'move-statement' | null
  >(null);
  const [statementAction, setStatementAction] = useState<
    'check' | 'pay' | 'reopen' | 'early-close' | null
  >(null);
  const account = accounts.find((a) => a.id === t.account_id);
  const transfer = t.kind === 'transfer' || t.kind === 'card_payment';
  const financialLock =
    t.origin === 'imported'
      ? 'Importada: valor, data, conta e beneficiário protegidos. Classificação editável.'
      : (!installment && t.kind !== 'regular') || t.origin !== 'manual'
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
      (t.origin === 'manual' &&
        ['regular', 'transfer', 'card_payment', 'installment'].includes(
          t.kind,
        )));
  const canSplit =
    ['regular', 'installment'].includes(t.kind) &&
    t.origin !== 'adjustment' &&
    (!t.advance_id || t.installment_number === null);
  async function patch(body: object) {
    if (installment) {
      await new Promise<void>((resolve, reject) => {
        setScopeError('');
        setScope({ body, resolve, reject });
      });
    } else
      await api(`/transactions/${t.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    await onSaved();
  }
  async function classify(category_id: string) {
    const category = categories.find((c) => c.id === category_id);
    await patch({
      category_id: category_id || null,
      ...(!financialLock && !installment
        ? {
            amount_cents:
              Math.abs(t.amount_cents) * (category?.effective_income ? -1 : 1),
          }
        : {}),
    });
  }
  const categoryEditor = (
    draft: string,
    change: (v: string, immediate?: boolean) => void,
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
  const displayAmount = transfer
    ? accountFilter === t.destination_account_id
      ? -Math.abs(t.destination_amount_cents ?? t.amount_cents)
      : Math.abs(t.amount_cents)
    : t.amount_cents;
  const showDirection = !transfer || !!accountFilter;
  return (
    <>
      <tr data-transaction-id={t.id} aria-selected={selected}>
        <td>
          <input
            type="checkbox"
            aria-label={`Selecionar ${t.payee}`}
            checked={selected}
            onChange={onSelect}
          />
        </td>
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
          locked={
            installment ? 'A conta pertence à compra original.' : financialLock
          }
          save={(account_id) => patch({ account_id })}
          editor={(draft, change) => (
            <select
              aria-label={`Conta de ${t.payee}`}
              value={draft}
              onChange={(e) => change(e.target.value, true)}
            >
              <AccountOptions accounts={accounts} />
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
              {transfer ? `→ ${t.destination_name ?? 'Destino'}` : t.payee}
              {t.installment_number
                ? ` · ${t.installment_number}/${t.installment_count}`
                : ''}
              {t.retroactive ? ' · Retroativa' : ''}
              {t.added_to_closed ? ' · Após fechamento' : ''}
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
            amount: String(Math.abs(t.amount_cents) / 100).replace('.', ','),
            income: t.amount_cents < 0,
            rate: String(t.fx_rate),
          })}
          locked={financialLock}
          display={
            <span className={!transfer && displayAmount < 0 ? 'income' : ''}>
              {showDirection ? (displayAmount < 0 ? '+ ' : '− ') : ''}
              {formatMoney(
                Math.abs(displayAmount),
                transfer && accountFilter === t.destination_account_id
                  ? (t.destination_currency ?? t.currency)
                  : t.currency,
              )}
            </span>
          }
          save={(value) => {
            const v = JSON.parse(value);
            const amount = parseMoney(v.amount);
            if (amount < 0) throw new Error('Digite o valor sem sinal.');
            return patch({
              amount_cents: amount * (v.income ? -1 : 1),
              ...(v.rate !== String(t.fx_rate)
                ? { fx_rate: Number(v.rate.replace(',', '.')) }
                : {}),
            });
          }}
          editor={(draft, change) => {
            const v = JSON.parse(draft);
            return (
              <>
                <div className="signed-value">
                  <span>{t.currency}</span>
                  <Button
                    type="button"
                    aria-label="Inverter sinal"
                    aria-pressed={v.income}
                    onClick={() =>
                      change(JSON.stringify({ ...v, income: !v.income }))
                    }
                  >
                    {v.income ? '[+]' : '[-]'}
                  </Button>
                  <input
                    required
                    aria-label={`Valor (${t.currency})`}
                    inputMode="decimal"
                    value={v.amount}
                    onChange={(e) =>
                      change(JSON.stringify({ ...v, amount: e.target.value }))
                    }
                  />
                </div>
                {t.currency !== 'BRL' && !installment && (
                  <details className="row-menu fx-menu" onToggle={positionMenu}>
                    <summary>Cotação</summary>
                    <div className="menu-panel">
                      <label>
                        Cotação manual
                        <input
                          inputMode="decimal"
                          value={v.rate}
                          onChange={(e) =>
                            change(
                              JSON.stringify({ ...v, rate: e.target.value }),
                            )
                          }
                        />
                      </label>
                      <small>
                        {formatMoney(t.amount_brl_cents)} · PTAX ou cotação
                        manual
                      </small>
                    </div>
                  </details>
                )}
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
          save={classify}
          editor={categoryEditor}
        />
        <SpreadsheetCell
          column={5}
          label={`Alocação de ${t.payee}`}
          value={t.category_id ?? ''}
          locked={categoryLock}
          display={
            t.split_count
              ? 'Por parte'
              : categories.find((c) => c.id === t.category_id)
                    ?.effective_exclude_budget
                ? 'Fora do orçamento'
                : (t.allocation_name ?? 'Sem alocação')
          }
          open={t.split_count ? () => onSplit(t) : undefined}
          save={classify}
          editor={(draft, change) => <>{categoryEditor(draft, change)}</>}
        />
        <SpreadsheetCell
          column={6}
          label={`Nota de ${t.payee}`}
          value={t.note}
          display={t.note || 'Adicionar nota'}
          save={(note) => patch({ note })}
          editor={(draft, change) => (
            <input
              aria-label={`Nota de ${t.payee}`}
              maxLength={2000}
              value={draft}
              onChange={(e) => change(e.target.value)}
            />
          )}
        />
        <SpreadsheetCell
          column={7}
          label={`Tags de ${t.payee}`}
          value={JSON.stringify(t.tags.map((tag) => tag.id))}
          locked={
            tagEditable
              ? undefined
              : t.split_count
                ? undefined
                : 'Tags protegidas neste lançamento.'
          }
          open={t.split_count ? () => onSplit(t) : undefined}
          display={
            t.split_count
              ? 'Por parte'
              : t.tags.map((t) => t.name).join(', ') || 'Sem tags'
          }
          save={(value) => patch({ tag_ids: JSON.parse(value) })}
          editor={(draft, change) => {
            const ids = JSON.parse(draft) as string[];
            return (
              <details className="row-menu" open onToggle={positionMenu}>
                <summary>Tags</summary>
                <div className="menu-panel">
                  {tags.map((tag) => (
                    <label className="tag-choice" key={tag.id}>
                      <input
                        type="checkbox"
                        checked={ids.includes(tag.id)}
                        onChange={(e) =>
                          change(
                            JSON.stringify(
                              e.target.checked
                                ? [...ids, tag.id]
                                : ids.filter((id) => id !== tag.id),
                            ),
                          )
                        }
                      />
                      {tag.name}
                    </label>
                  ))}
                </div>
              </details>
            );
          }}
        />
        <SpreadsheetCell
          column={8}
          label={`Origem de ${t.payee}`}
          value={t.origin}
          locked="Origem definida pelo sistema."
          display={
            <>
              <Badge origin={t.origin} />
              {financialLock && (
                <span
                  className="row-lock"
                  title={financialLock}
                  aria-label={financialLock}
                >
                  {' '}
                  · Protegida
                </span>
              )}
            </>
          }
        />
        <SpreadsheetCell
          column={9}
          label={`Parcelas de ${t.payee}`}
          value=""
          locked={
            t.installment_plan_id
              ? undefined
              : 'Parcelas disponíveis para compras no cartão.'
          }
          display={
            t.installment_number
              ? `${t.installment_number}/${t.installment_count}`
              : account?.kind === 'credit_card' && !transfer
                ? '1x'
                : ''
          }
          open={
            t.installment_plan_id
              ? () => {
                  location.href = `/parceladas/${t.installment_plan_id}`;
                }
              : undefined
          }
        />
        <td>
          <details onToggle={positionMenu} className="row-menu">
            <summary aria-label={`Ações de ${t.payee}`}>⋯</summary>
            <div className="menu-panel">
              {canSplit && (
                <Button onClick={() => onSplit(t)}>
                  {t.split_count ? 'Editar divisão' : 'Dividir transação'}
                </Button>
              )}
              {['regular', 'installment'].includes(t.kind) &&
                t.origin !== 'adjustment' &&
                !t.advance_id && (
                  <Button onClick={() => onRecurring(t)}>
                    Criar recorrente
                  </Button>
                )}
              {account?.kind === 'credit_card' &&
                ['regular', 'installment'].includes(t.kind) &&
                t.origin === 'manual' &&
                !t.advance_id && (
                  <Button onClick={() => setAction('move-statement')}>
                    Mover de fatura
                  </Button>
                )}
              {installment && (
                <Button onClick={() => setAction('cancel-future')}>
                  Cancelar parcelas futuras
                </Button>
              )}
              {(t.statement_id || account?.kind === 'credit_card') && (
                <>
                  {t.statement_status === 'open' && (
                    <>
                      <Button onClick={() => setStatementAction('check')}>
                        Conferir e fechar fatura
                      </Button>
                      <Button onClick={() => setStatementAction('early-close')}>
                        Antecipar fechamento
                      </Button>
                    </>
                  )}
                  {t.statement_status === 'closed' && (
                    <>
                      <Button onClick={() => setStatementAction('reopen')}>
                        Reabrir fatura
                      </Button>
                      <Button onClick={() => setStatementAction('pay')}>
                        Pagar fatura
                      </Button>
                    </>
                  )}
                </>
              )}
              {t.installment_plan_id && (
                <>
                  <a href={`/parceladas/${t.installment_plan_id}`}>
                    Ver compra original
                  </a>
                  <a href={`/parceladas/${t.installment_plan_id}`}>
                    Antecipar parcelas
                  </a>
                </>
              )}
            </div>
          </details>
        </td>
      </tr>
      {scope && (
        <tr className="dialog-row">
          <td colSpan={12}>
            <Modal
              title="Editar parcela"
              busy={scopeBusy}
              onClose={() => {
                scope.reject(new Error('Edição cancelada.'));
                setScope(null);
              }}
            >
              <p>Aplicar a alteração de {t.payee} em qual parte da compra?</p>
              <div className="actions">
                {[
                  ['one', 'Só esta'],
                  ['future', 'Esta e as futuras'],
                ].map(([value, label]) => (
                  <Button
                    key={value}
                    disabled={scopeBusy}
                    onClick={async () => {
                      setScopeBusy(true);
                      setScopeError('');
                      try {
                        await api(`/transactions/${t.id}/installment-edit`, {
                          method: 'POST',
                          body: JSON.stringify({ ...scope.body, scope: value }),
                        });
                        scope.resolve();
                        setScope(null);
                      } catch (e) {
                        setScopeError((e as Error).message);
                      } finally {
                        setScopeBusy(false);
                      }
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p role="alert">{scopeError}</p>
            </Modal>
          </td>
        </tr>
      )}
      {action && (
        <tr className="dialog-row">
          <td colSpan={12}>
            <TransactionAction
              transaction={t}
              mode={action}
              onClose={() => setAction(null)}
              onSaved={onSaved}
            />
          </td>
        </tr>
      )}
      {statementAction && (
        <tr className="dialog-row">
          <td colSpan={12}>
            <StatementFromTable
              transaction={t}
              accounts={accounts}
              mode={statementAction}
              onClose={() => setStatementAction(null)}
              onSaved={onSaved}
            />
          </td>
        </tr>
      )}
    </>
  );
}
