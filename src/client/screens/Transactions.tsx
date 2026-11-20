import { NewTransferRow } from '../components/NewTransferRow';
import { useEffect, useState } from 'react';
import type { Account, Category, Transaction, Tag } from '../../shared/types';
import {
  PageHeader,
  Select,
  Field,
  State,
  Menu,
  Button,
  Table,
  CategoryOptions,
} from '../components';
import { api, humanDate } from '../api';
import { today } from '../../shared/dates';
import { useMoney } from '../privacy';
import {
  readTransactionFilters,
  transactionsUrl,
  type TransactionFilters,
} from '../transaction-filters';
import { currentMonth, validMonth } from '../../shared/recurring';
import { MonthNavigation } from '../components/MonthNavigation';
import { SplitTransaction } from '../components/SplitTransaction';
import { TransactionRow } from '../components/TransactionRow';
import { RecurringEditor } from './Recurring';
import { NewTransactionRow } from '../components/NewTransactionRow';
import { AccountOptions, movementAccounts } from '../components/AccountOptions';
import { MonthSummary } from '../components/MonthSummary';
import { BulkTransactions } from '../components/BulkTransactions';
import { Modal } from '../components';
import { ManualTransaction } from '../components/ManualTransaction';
const summaryStorageKey = 'bfo:month-summary-expanded';
const summaryWideScreen = '(min-width: 1101px)';

type Page = {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
  total_amount_cents?: number;
  previous_balance_cents?: number;
};
export function Transactions({
  accounts,
  categories,
  revision,
  onSaved,
  path,
  urlSearch,
  navigate,
}: {
  path: string;
  urlSearch: string;
  navigate: (to: string, replace?: boolean) => void;
  accounts: Account[];
  categories: Category[];
  revision: number;
  onSaved: () => Promise<void>;
}) {
  const formatMoney = useMoney();
  const rawMonth = path.split('/')[2] ?? currentMonth();
  const month = validMonth(rawMonth) ? rawMonth : currentMonth();
  const [showFilters, setShowFilters] = useState(false);
  const [wideScreen, setWideScreen] = useState(
    () => window.matchMedia(summaryWideScreen).matches,
  );
  const [summaryPreference, setSummaryPreference] = useState<boolean | null>(
    () => {
      try {
        const saved = localStorage.getItem(summaryStorageKey);
        return saved === 'true' ? true : saved === 'false' ? false : null;
      } catch {
        return null;
      }
    },
  );
  const showSummary = summaryPreference ?? wideScreen;

  useEffect(() => {
    const media = window.matchMedia(summaryWideScreen);
    const updateWidth = () => setWideScreen(media.matches);
    updateWidth();
    media.addEventListener('change', updateWidth);
    return () => media.removeEventListener('change', updateWidth);
  }, []);

  function toggleSummary() {
    const expanded = !showSummary;
    setSummaryPreference(expanded);
    try {
      localStorage.setItem(summaryStorageKey, String(expanded));
    } catch {
      // A escolha continua valendo enquanto a tela estiver aberta.
    }
  }

  const [adding, setAdding] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [purchase, setPurchase] = useState(false);
  const [defaultAccount, setDefaultAccount] = useState('');
  const [chosenAccount, setChosenAccount] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const active = movementAccounts(accounts);
  const entryAccount =
    chosenAccount ||
    active.find((a) => a.id === defaultAccount)?.id ||
    active[0]?.id ||
    '';
  useEffect(() => {
    api<{ default_account_id: string | null }>('/preferences')
      .then((p) => setDefaultAccount(p.default_account_id ?? ''))
      .catch((e) => setError(e.message));
  }, [revision]);
  const [splitting, setSplitting] = useState<Transaction | null>(null);
  const [recurring, setRecurring] = useState<Transaction | null>(null);
  useEffect(() => {
    if (path === '/transacoes' || path === '/')
      navigate(`/transacoes/${month}${urlSearch ? `?${urlSearch}` : ''}`, true);
    setSelected([]);
    setAdding(false);
  }, [path]);
  const { search, ...filters } = readTransactionFilters(urlSearch);
  const drill =
    filters.summary ||
    filters.statement ||
    filters.transaction ||
    filters.balance;
  const onlyAccount =
    !!filters.account &&
    !search &&
    !Object.entries(filters).some(
      ([key, value]) => key !== 'account' && key !== 'balance' && value,
    );
  const balanceAccount = onlyAccount
    ? accounts.find((a) => a.id === filters.account)
    : undefined;
  const drillAccount = accounts.find((a) => a.id === filters.account);
  const extraColumn = balanceAccount
    ? balanceAccount.kind === 'credit_card'
      ? 'Saldo do cartão'
      : 'Saldo corrido'
    : filters.summary
      ? 'No total (R$)'
      : '';
  const categoryName =
    categories.find((c) => c.id === filters.category)?.name ??
    (filters.category === 'none' ? 'Sem categoria' : '');
  const groupName =
    categories.find((c) => c.category_group_id === filters.group)?.group_name ??
    (filters.group === 'none' ? 'Sem grupo' : '');
  const filterCount = Object.entries(filters).filter(
    ([key, value]) => key !== 'statementTotal' && value,
  ).length;
  const [tags, setTags] = useState<Tag[]>([]);
  useEffect(() => {
    api<Tag[]>('/tags')
      .then(setTags)
      .catch((e) => setError(e.message));
  }, [revision]);
  const [pagination, setPagination] = useState({ address: '', page: 1 });
  const address = transactionsUrl(month, { ...filters, search });
  const page = pagination.address === address ? pagination.page : 1;
  const setPage = (page: number) => setPagination({ address, page });
  const [result, setResult] = useState<{ query: string; data: Page } | null>(
    null,
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const matching = new URLSearchParams({ month });
  for (const [key, value] of Object.entries({ ...filters, search })) {
    if (value) matching.set(key, value);
  }
  const query = `${matching}&page=${page}`;
  const data = result?.query === query ? result.data : null;
  useEffect(() => {
    if (data)
      setSelected((ids) =>
        ids.filter((id) => data.items.some((t) => t.id === id)),
      );
  }, [data]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api<Page>(`/transactions?${query}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ query, data });
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, revision, retry]);
  function filter(key: keyof TransactionFilters, value: string) {
    const next = { ...filters, search, [key]: value };
    if (key === 'account' && value !== filters.account) next.balance = '';
    navigate(transactionsUrl(month, next), key === 'search');
    setSelected([]);
    setPage(1);
  }
  function changeMonth(next: string) {
    if (month === next && !drill) return;
    navigate(
      transactionsUrl(next, {
        ...filters,
        search,
        statement: '',
        statementTotal: '',
        transaction: '',
        balance: '',
      }),
    );
  }
  const entryAccountName = accounts.find((a) => a.id === entryAccount)?.name;
  return (
    <>
      <PageHeader
        title="Transações"
        context={<MonthNavigation month={month} onChange={changeMonth} />}
        actions={
          <div className="add-control">
            <Button
              variant="primary"
              title={entryAccountName}
              disabled={!entryAccount}
              onClick={() => {
                setTransfer(false);
                setAdding(true);
              }}
            >
              Adicionar em {entryAccountName ?? 'conta'}
            </Button>
            <Select
              aria-label="Escolher conta para adicionar"
              value={entryAccount}
              onChange={(e) => {
                if (e.target.value === 'transfer') {
                  setTransfer(true);
                  setAdding(true);
                  return;
                }
                setTransfer(false);
                setChosenAccount(e.target.value);
                setAdding(true);
              }}
            >
              <option value="transfer">Nova transferência</option>
              <AccountOptions accounts={accounts} />
            </Select>
          </div>
        }
      />
      {!validMonth(rawMonth) && (
        <State kind="error">Mês inválido. Mostrando o mês atual.</State>
      )}
      <div className="toolbar">
        <label className="quick-search">
          <span className="sr-only">Busca rápida</span>
          <Field
            type="search"
            placeholder="Buscar beneficiário ou nota"
            value={search}
            onChange={(e) => filter('search', e.target.value)}
          />
        </label>
        <Button
          aria-expanded={showFilters}
          aria-controls="transaction-filters"
          onClick={() => setShowFilters(!showFilters)}
        >
          Filtros
          {filterCount ? ` (${filterCount})` : ''}
        </Button>
        <Button
          aria-expanded={showSummary}
          aria-controls="transaction-month-summary"
          onClick={toggleSummary}
        >
          {showSummary ? 'Recolher resumo do mês' : 'Expandir resumo do mês'}
        </Button>
        {!loading && data && !error && (
          <a
            className="button action-link"
            href={`/api/transactions.csv?${matching}`}
            download
          >
            Baixar CSV
          </a>
        )}
        <Menu trigger="Mais opções">
          <Button onClick={() => setPurchase(true)}>
            Lançar compra parcelada
          </Button>
        </Menu>
      </div>
      <p className="sheet-help">
        Clique na célula para editar. Salva ao sair. Enter avança para baixo,
        Tab para a próxima célula e Esc cancela. Use as setas para mover a
        seleção.
      </p>
      {showFilters && (
        <section
          id="transaction-filters"
          className="filters"
          aria-label="Filtros de transações"
        >
          <label>
            Conta
            <select
              value={filters.account}
              onChange={(e) => filter('account', e.target.value)}
            >
              <option value="">Todas</option>
              {accounts
                .filter(
                  (a) =>
                    a.id === filters.account || (!a.closed_at && !a.archived),
                )
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Categoria
            <select
              value={filters.category}
              onChange={(e) => filter('category', e.target.value)}
            >
              <option value="">Todas</option>
              {filters.summary && <option value="none">Sem categoria</option>}
              <CategoryOptions categories={categories} />
            </select>
          </label>
          <label>
            Tag
            <select
              value={filters.tag}
              onChange={(e) => filter('tag', e.target.value)}
            >
              <option value="">Todas</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            De
            <input
              aria-label="Data inicial"
              type="date"
              value={filters.from}
              onChange={(e) => filter('from', e.target.value)}
            />
          </label>
          <label>
            Até
            <input
              aria-label="Data final"
              type="date"
              value={filters.to}
              onChange={(e) => filter('to', e.target.value)}
            />
          </label>
          <label>
            Origem
            <select
              value={filters.origin}
              onChange={(e) => filter('origin', e.target.value)}
            >
              <option value="">Todas</option>
              <option value="imported">Importado</option>
              <option value="manual">Manual</option>
              <option value="adjustment">Ajuste</option>
            </select>
          </label>
          <Button
            onClick={() => {
              navigate(transactionsUrl(month, { search }));
              setSelected([]);
              setPage(1);
            }}
          >
            Limpar filtros
          </Button>
        </section>
      )}
      <div
        className={
          showSummary && wideScreen
            ? 'transactions-layout transactions-layout-wide'
            : 'transactions-layout'
        }
      >
        <div
          id="transaction-month-summary"
          className="transactions-summary"
          hidden={!showSummary}
        >
          {showSummary && (
            <MonthSummary
              month={month}
              revision={revision}
              navigate={(to) => {
                navigate(to);
                setPage(1);
                setSelected([]);
              }}
            />
          )}
        </div>
        <section className="transactions-main">
          {!data && !error ? (
            <State kind="loading">Carregando transações…</State>
          ) : error ? (
            <State
              kind="error"
              action={
                <Button onClick={() => setRetry(retry + 1)}>
                  Tentar novamente
                </Button>
              }
            >
              {error}
            </State>
          ) : (
            data && (
              <>
                <p className="count" role="status">
                  {data.total} transações · Entrada soma ao saldo; saída reduz o
                  saldo.
                </p>
                {drill && (
                  <div className="drill-detail">
                    <div className="inline-actions">
                      <strong>
                        {filters.summary
                          ? [
                              filters.summary === 'income'
                                ? 'Renda'
                                : 'Despesas',
                              groupName,
                              categoryName,
                            ]
                              .filter(Boolean)
                              .join(' · ')
                          : filters.statement
                            ? filters.statementTotal
                              ? 'Total da fatura'
                              : 'Compras do ciclo'
                            : filters.balance
                              ? `Saldo até hoje · ${drillAccount?.name ?? 'Conta'}`
                              : 'Transação de origem'}
                        {data.total_amount_cents !== undefined &&
                          ` · ${formatMoney(data.total_amount_cents, filters.summary ? 'BRL' : (drillAccount?.currency ?? data.items[0]?.currency))}`}
                        {filters.balance &&
                          drillAccount &&
                          ` · ${formatMoney(drillAccount.balance_cents, drillAccount.currency)}`}
                      </strong>
                      <Button
                        variant="quiet"
                        onClick={() => navigate(transactionsUrl(month, {}))}
                      >
                        Voltar ao mês
                      </Button>
                    </div>
                    {filters.summary && (
                      <p>
                        Transferências e itens fora dos totais ficam de fora.
                        Nas divisões, “No total” soma só as partes que
                        correspondem ao filtro. Parcelas contam no mês da
                        fatura. Lançamentos futuros contam no mês do resumo e
                        afetam o saldo só na data.
                      </p>
                    )}
                    {!!data.previous_balance_cents && (
                      <p>
                        Inclui{' '}
                        {formatMoney(
                          data.previous_balance_cents,
                          drillAccount?.currency,
                        )}{' '}
                        de saldo anterior, transportado da fatura anterior sem
                        gerar outra transação.
                      </p>
                    )}
                    {filters.balance && (
                      <p>
                        {drillAccount?.cutoff_date && (
                          <>
                            Saldo de abertura em{' '}
                            {humanDate(drillAccount.cutoff_date)}:{' '}
                            {formatMoney(
                              drillAccount.opening_balance_cents,
                              drillAccount.currency,
                            )}
                            .{' '}
                          </>
                        )}
                        Transferências movimentam a conta. Lançamentos futuros
                        entram no saldo na data.
                      </p>
                    )}
                    {filters.transaction &&
                      data.items.some((t) => t.date > today()) && (
                        <p>
                          Lançamento futuro. Entra no saldo da conta na data.
                        </p>
                      )}
                    {filters.transaction &&
                      data.items.some((t) =>
                        ['transfer', 'card_payment'].includes(t.kind),
                      ) && (
                        <p>
                          Movimenta as duas contas e fica fora dos totais de
                          renda e despesa.
                        </p>
                      )}
                  </div>
                )}
                {!!selected.length && (
                  <BulkTransactions
                    items={data.items.filter((t) => selected.includes(t.id))}
                    categories={categories}
                    tags={tags}
                    onSaved={onSaved}
                    onClear={() => setSelected([])}
                  />
                )}
                <div
                  className={`sheet-table${extraColumn ? ' sheet-table-extra' : ''}`}
                >
                  <label className="select-page">
                    <input
                      type="checkbox"
                      aria-label="Selecionar página"
                      checked={
                        data.items.length > 0 &&
                        data.items.every((t) => selected.includes(t.id))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? data.items.map((t) => t.id) : [],
                        )
                      }
                    />
                    Selecionar página
                  </label>
                  <Table
                    headers={[
                      '',
                      'Data',
                      'Conta',
                      'Beneficiário',
                      'Valor',
                      ...(extraColumn ? [extraColumn] : []),
                      'Categoria',
                      'Alocação',
                      'Notas',
                      'Tags',
                      'Origem',
                      'Parcelas',
                      'Ações',
                    ]}
                    numeric={extraColumn ? [4, 5] : [4]}
                    label="Transações"
                  >
                    <>
                      {adding &&
                        (transfer ? (
                          <NewTransferRow
                            key={month}
                            extraColumn={!!extraColumn}
                            initialAccount={entryAccount}
                            month={month}
                            accounts={accounts}
                            tags={tags}
                            onSaved={onSaved}
                            onCancel={() => setAdding(false)}
                          />
                        ) : (
                          <NewTransactionRow
                            key={month}
                            extraColumn={!!extraColumn}
                            initialAccount={entryAccount}
                            month={month}
                            accounts={accounts}
                            categories={categories}
                            tags={tags}
                            onSaved={onSaved}
                            onCancel={() => setAdding(false)}
                          />
                        ))}
                      {data.items.map((t) => (
                        <TransactionRow
                          key={t.id}
                          t={t}
                          selected={selected.includes(t.id)}
                          onSelect={() =>
                            setSelected(
                              selected.includes(t.id)
                                ? selected.filter((id) => id !== t.id)
                                : [...selected, t.id],
                            )
                          }
                          accountFilter={filters.account}
                          balanceAccount={balanceAccount}
                          showContribution={!!filters.summary}
                          accounts={accounts}
                          categories={categories}
                          tags={tags}
                          onSaved={onSaved}
                          onRecurring={setRecurring}
                          onSplit={setSplitting}
                        />
                      ))}
                      {!data.items.length && (
                        <tr>
                          <td colSpan={extraColumn ? 13 : 12}>
                            <State kind="empty">
                              Nenhuma transação encontrada para estes filtros.
                            </State>
                          </td>
                        </tr>
                      )}
                    </>
                  </Table>
                </div>
                <div className="pagination">
                  <Button
                    disabled={page <= 1}
                    onClick={() => {
                      setPage(page - 1);
                      setSelected([]);
                    }}
                  >
                    Anterior
                  </Button>
                  <span>
                    Página {page} de{' '}
                    {Math.max(1, Math.ceil(data.total / data.page_size))}
                  </span>
                  <Button
                    disabled={page * data.page_size >= data.total}
                    onClick={() => {
                      setPage(page + 1);
                      setSelected([]);
                    }}
                  >
                    Próxima
                  </Button>
                </div>
              </>
            )
          )}
        </section>
      </div>
      {purchase && (
        <Modal title="Compra parcelada" onClose={() => setPurchase(false)}>
          <ManualTransaction
            accounts={accounts}
            categories={categories}
            onSaved={onSaved}
            month={month}
          />
        </Modal>
      )}
      {splitting && (
        <SplitTransaction
          transaction={splitting}
          categories={categories}
          tags={tags}
          onSaved={onSaved}
          onClose={() => setSplitting(null)}
        />
      )}
      {recurring && (
        <RecurringEditor
          transaction={recurring}
          accounts={accounts}
          categories={categories}
          onSaved={onSaved}
          onClose={() => setRecurring(null)}
        />
      )}
    </>
  );
}
