import { FinancialInput, useMoney } from '../privacy';
import { useEffect, useState, useRef } from 'react';
import type {
  Account,
  Category,
  Named,
  Recurring,
  Transaction,
} from '../../shared/types';
import { currentMonth } from '../../shared/recurring';
import { parseMoney } from '../../shared/money';
import { api, humanDate } from '../api';
import {
  PageHeader,
  Panel,
  State,
  Truncated,
  Button,
  Modal,
  Table,
} from '../components';
import { MonthNavigation } from '../components/MonthNavigation';
import { CategoryPicker } from '../components/CategoryPicker';
import { Editor } from './Configuration';
export const cadenceLabel: Record<string, string> = {
  monthly: 'Mensal',
  yearly: 'Anual',
  weekly: 'Semanal',
  custom: 'A cada intervalo',
};
export function RecurringEditor({
  item,
  transaction,
  accounts,
  categories,
  onSaved,
  onClose,
}: {
  item?: Recurring;
  transaction?: Transaction;
  accounts: Account[];
  categories: Category[];
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [types, setTypes] = useState<Named[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    account_id:
      item?.account_id ??
      transaction?.account_id ??
      accounts.find(
        (a) =>
          !a.closed_at &&
          !a.archived &&
          ['checking', 'cash', 'credit_card'].includes(a.kind),
      )?.id ??
      '',
    payee: item?.payee ?? transaction?.payee ?? '',
    amount: String(
      (item?.amount_cents ?? transaction?.amount_cents ?? 0) / 100,
    ).replace('.', ','),
    category_id: item?.category_id ?? transaction?.category_id ?? '',
    cadence: item?.cadence ?? 'monthly',
    next_date: item?.next_date ?? transaction?.date ?? `${currentMonth()}-01`,
    interval_days: String(item?.interval_days ?? 30),
    description: item?.description ?? '',
    is_subscription: item?.is_subscription ?? 0,
    subscription_type_id: item?.subscription_type_id ?? '',
    renewal_date: item?.renewal_date ?? '',
    notice_days: String(item?.notice_days ?? 30),
    active: item?.active ?? 1,
  });
  const field = (k: keyof typeof form, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));
  useEffect(() => {
    api<Named[]>('/subscription-types')
      .then(setTypes)
      .catch((e) => setError(e.message));
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { amount, ...rest } = form;
      await api(`/recurring${item ? `/${item.id}` : ''}`, {
        method: item ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...rest,
          amount_cents: parseMoney(amount),
          notice_days: Number(form.notice_days),
          interval_days:
            form.cadence === 'custom' ? Number(form.interval_days) : null,
          category_id: form.category_id || null,
          subscription_type_id: form.is_subscription
            ? form.subscription_type_id
            : null,
          renewal_date: form.is_subscription ? form.renewal_date : null,
          ...(transaction ? { transaction_id: transaction.id } : {}),
        }),
      });
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const code =
    accounts.find((a) => a.id === form.account_id)?.currency ?? 'BRL';
  return (
    <Modal
      title={item ? 'Editar recorrente' : 'Criar recorrente'}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <label>
            Beneficiário
            <input
              required
              maxLength={200}
              value={form.payee}
              onChange={(e) => field('payee', e.target.value)}
            />
          </label>
          <label>
            Descrição
            <input
              maxLength={2000}
              value={form.description}
              onChange={(e) => field('description', e.target.value)}
            />
          </label>
          <label>
            Conta
            <select
              value={form.account_id}
              onChange={(e) => field('account_id', e.target.value)}
            >
              {accounts
                .filter(
                  (a) =>
                    !a.archived &&
                    !a.closed_at &&
                    ['checking', 'cash', 'credit_card'].includes(a.kind),
                )
                .map((a) => (
                  <option value={a.id} key={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Valor ({code})
            <FinancialInput
              required
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => field('amount', e.target.value)}
            />
            <small>Negativo para entrada.</small>
          </label>
          <CategoryPicker
            categories={categories}
            value={form.category_id}
            onChange={(v) => field('category_id', v)}
          />
          <label>
            Frequência
            <select
              value={form.cadence}
              onChange={(e) => field('cadence', e.target.value)}
            >
              {Object.entries(cadenceLabel).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          {form.cadence === 'custom' && (
            <label>
              Intervalo em dias
              <input
                type="number"
                required
                min="1"
                max="3660"
                value={form.interval_days}
                onChange={(e) => field('interval_days', e.target.value)}
              />
            </label>
          )}
          <label>
            Primeira cobrança prevista
            <input
              type="date"
              required
              value={form.next_date}
              onChange={(e) => field('next_date', e.target.value)}
            />
            <small>
              O calendário começa nesta data e preserva o histórico dos meses.
            </small>
          </label>
          <label className="tag-choice">
            <input
              type="checkbox"
              checked={!!form.active}
              onChange={(e) => field('active', e.target.checked ? 1 : 0)}
            />
            Ativo
          </label>
          <label className="tag-choice">
            <input
              type="checkbox"
              checked={!!form.is_subscription}
              onChange={(e) =>
                field('is_subscription', e.target.checked ? 1 : 0)
              }
            />
            Assinatura
          </label>
          {!!form.is_subscription && (
            <>
              <label>
                Tipo de assinatura
                <select
                  required
                  value={form.subscription_type_id}
                  onChange={(e) =>
                    field('subscription_type_id', e.target.value)
                  }
                >
                  <option value="">Escolha</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prazo de aviso em dias
                <input
                  type="number"
                  required
                  min="0"
                  max="3660"
                  value={form.notice_days}
                  onChange={(e) => field('notice_days', e.target.value)}
                />
              </label>
              <a className="action-link" href="/tipos-assinatura">
                Criar e editar tipos
              </a>
              <label>
                Data de renovação
                <input
                  type="date"
                  required
                  value={form.renewal_date}
                  onChange={(e) => field('renewal_date', e.target.value)}
                />
              </label>
            </>
          )}
          <Button type="submit">Salvar recorrente</Button>
        </fieldset>
        <p role="alert">{error}</p>
      </form>
    </Modal>
  );
}
type Summary = Record<
  string,
  Record<string, { expected: number; actual: number }>
>;
export function RecurringScreen({
  accounts,
  categories,
  onSaved,
  subscriptions = false,
}: {
  accounts: Account[];
  categories: Category[];
  onSaved: () => Promise<void>;
  subscriptions?: boolean;
}) {
  const formatMoney = useMoney();
  const [month, setMonth] = useState(currentMonth()),
    [rows, setRows] = useState<Recurring[]>([]),
    [summary, setSummary] = useState<Summary>({}),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [group, setGroup] = useState('type_name'),
    [catalog, setCatalog] = useState(false),
    [editing, setEditing] = useState<Recurring | null | undefined>(undefined);
  const loadSequence = useRef(0);
  async function load() {
    const sequence = ++loadSequence.current;
    setError('');
    setLoading(true);
    try {
      if (subscriptions) {
        const result = await api<Recurring[]>('/subscriptions');
        if (sequence === loadSequence.current) setRows(result);
      } else {
        const d = await api<{ items: Recurring[]; summary: Summary }>(
          `/recurring?month=${month}&catalog=${catalog ? 1 : 0}`,
        );
        if (sequence === loadSequence.current) {
          setRows(d.items);
          setSummary(d.summary);
        }
      }
    } catch (e) {
      if (sequence === loadSequence.current) setError((e as Error).message);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      loadSequence.current++;
    };
  }, [month, subscriptions, catalog]);
  const groupKey = subscriptions ? group : 'category_name';
  const groups = [
    ...new Set(
      rows.map((r) =>
        String(
          r[groupKey as keyof Recurring] ??
            (groupKey === 'category_name' ? 'Sem categoria' : 'Sem grupo'),
        ),
      ),
    ),
  ];
  return (
    <>
      <PageHeader
        title={subscriptions ? 'Assinaturas' : 'Recorrentes'}
        context={
          subscriptions ? (
            'Cobranças e renovações'
          ) : (
            <MonthNavigation month={month} onChange={setMonth} />
          )
        }
        actions={
          <Button variant="primary" onClick={() => setEditing(null)}>
            Novo recorrente
          </Button>
        }
      />
      {subscriptions ? (
        <>
          <p>
            Anuais entram no planejamento no mês da cobrança. O equivalente
            mensal é informativo.
          </p>
          <label className="compact-field">
            Agrupar por
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="type_name">Tipo de assinatura</option>
              <option value="allocation_name">Grupo de alocação</option>
            </select>
          </label>
          <a className="action-link" href="/tipos-assinatura">
            Criar e editar tipos de assinatura
          </a>
        </>
      ) : (
        <>
          <label className="tag-choice">
            <input
              type="checkbox"
              checked={catalog}
              onChange={(e) => setCatalog(e.target.checked)}
            />
            Ver todos os cadastros, incluindo inativos
          </label>
          <p>
            O estado relaciona cada cobrança a uma transação do mês, na mesma
            conta e com o mesmo beneficiário. Cada lançamento atende uma
            cobrança.
          </p>
          {Object.entries(summary).map(([currency, s]) => (
            <Panel className="recurring-totals" key={currency}>
              {Object.entries(s).map(([side, v]) => (
                <p key={side}>
                  {side === 'income' ? 'Entradas' : 'Saídas'}: esperado{' '}
                  {formatMoney(v.expected, currency)} · realizado{' '}
                  {formatMoney(v.actual, currency)}
                </p>
              ))}
            </Panel>
          ))}
        </>
      )}
      {loading && <State kind="loading">Carregando…</State>}
      {error && (
        <State
          kind="error"
          action={<Button onClick={() => void load()}>Tentar novamente</Button>}
        >
          {error}
        </State>
      )}
      {!loading && !error && !rows.length && (
        <State kind="empty">Nenhum item neste período.</State>
      )}
      {!loading &&
        !error &&
        groups.map((name) => {
          const items = rows.filter(
            (r) =>
              String(
                r[groupKey as keyof Recurring] ??
                  (groupKey === 'category_name'
                    ? 'Sem categoria'
                    : 'Sem grupo'),
              ) === name,
          );
          return (
            <Panel className="account-group" key={name}>
              <h2>{name}</h2>
              <Table
                label={name}
                numeric={[3]}
                widths={['22%', '10%', '17%', '17%', '13%', '13%', '8%']}
                headers={[
                  'Beneficiário',
                  'Frequência',
                  'Próxima data',
                  'Valor',
                  'Conta',
                  subscriptions ? 'Renovação' : 'Estado',
                  'Ações',
                ]}
              >
                {items.map((r) => (
                  <tr key={`${r.id}-${r.due_date ?? ''}`}>
                    <td>
                      <Truncated>{r.payee}</Truncated>
                      {r.description && (
                        <small>
                          <Truncated>{r.description}</Truncated>
                        </small>
                      )}
                    </td>
                    <td>
                      {r.cadence === 'custom'
                        ? `A cada ${r.interval_days} dias`
                        : cadenceLabel[r.cadence]}
                    </td>
                    <td>
                      {humanDate(subscriptions ? r.next_charge : r.due_date)}
                      <small>
                        {recognitionWindow(
                          subscriptions ? r.next_charge : r.due_date,
                        )}
                      </small>
                    </td>
                    <td className="numeric">
                      {formatMoney(r.amount_cents, r.currency)}
                      {subscriptions && (
                        <small>
                          Equivalente mensal: <br />
                          {formatMoney(r.monthly_cents, r.currency)}
                        </small>
                      )}
                    </td>
                    <td>
                      <Truncated>{r.account_name}</Truncated>
                    </td>
                    <td>
                      {subscriptions
                        ? r.renewal_date
                          ? humanDate(r.renewal_date)
                          : 'Sem data'
                        : catalog
                          ? r.active
                            ? 'Ativo'
                            : 'Inativo'
                          : r.arrived
                            ? 'Chegou'
                            : 'Ainda não'}
                      {subscriptions && (
                        <small>Aviso com {r.notice_days} dias</small>
                      )}
                      {!subscriptions && !catalog && r.arrived && (
                        <small>
                          Realizado: {formatMoney(r.actual_cents, r.currency)}
                        </small>
                      )}
                    </td>
                    <td>
                      <Button
                        variant="quiet"
                        aria-label={`Editar ${r.payee}`}
                        onClick={() => setEditing(r)}
                      >
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </Table>
              {subscriptions &&
                [...new Set(items.map((r) => r.currency))].map((code) => (
                  <p key={code}>
                    Total de {name} ({code}): equivalente mensal{' '}
                    {formatMoney(
                      items
                        .filter((r) => r.currency === code)
                        .reduce((s, r) => s + r.monthly_cents, 0),
                      code,
                    )}
                  </p>
                ))}
            </Panel>
          );
        })}
      {editing !== undefined && (
        <RecurringEditor
          item={editing ?? undefined}
          accounts={accounts}
          categories={categories}
          onSaved={async () => {
            await load();
            await onSaved();
          }}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
export function SubscriptionTypes({
  onSaved,
}: {
  onSaved: () => Promise<void>;
}) {
  return (
    <>
      <PageHeader
        title="Tipos de assinatura"
        context="Cadastros de assinaturas"
      />
      <Editor
        title="Tipos cadastrados"
        route="subscription-types"
        onSaved={() => void onSaved()}
      />
    </>
  );
}

function recognitionWindow(day: string) {
  const label = (offset: number) => {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + offset);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  return `reconhece de ${label(-7)} a ${label(7)}`;
}
