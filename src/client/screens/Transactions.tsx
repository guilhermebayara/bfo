import { positionMenu } from '../components/menu';
import { useEffect, useState } from 'react';
import type { Account, Category, Transaction, Tag } from '../../shared/types';
import { Button, Table, CategoryOptions } from '../components';
import { api } from '../api';
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
type Page = {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
};
export function Transactions({
  accounts,
  categories,
  revision,
  onSaved,
  path,
  navigate,
}: {
  path: string;
  navigate: (to: string, replace?: boolean) => void;
  accounts: Account[];
  categories: Category[];
  revision: number;
  onSaved: () => Promise<void>;
}) {
  const rawMonth = path.split('/')[2] ?? currentMonth();
  const month = validMonth(rawMonth) ? rawMonth : currentMonth();
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
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
      navigate(`/transacoes/${month}${location.search}`, true);
    setPage(1);
    setSelected([]);
    setAdding(false);
  }, [path]);
  const [filters, setFilters] = useState({
    tag: '',
    account: new URLSearchParams(location.search).get('account') ?? '',
    category: '',
    origin: '',
    from: new URLSearchParams(location.search).get('from') ?? '',
    to: new URLSearchParams(location.search).get('to') ?? '',
  });
  const [tags, setTags] = useState<Tag[]>([]);
  useEffect(() => {
    api<Tag[]>('/tags')
      .then(setTags)
      .catch((e) => setError(e.message));
  }, [revision]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (data)
      setSelected((ids) =>
        ids.filter((id) => data.items.some((t) => t.id === id)),
      );
  }, [data]);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const query = new URLSearchParams({
    ...filters,
    search,
    month,
    page: String(page),
  }).toString();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api<Page>(`/transactions?${query}`, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, revision, retry]);
  function filter(key: keyof typeof filters, value: string) {
    setFilters({ ...filters, [key]: value });
    setSelected([]);
    setPage(1);
  }
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Transações</h1>
          <p>
            Clique na célula para editar. Salva ao sair. Enter avança para
            baixo; Tab para a próxima célula; Esc cancela. Setas movem a
            seleção.
          </p>
        </div>
      </div>
      {!validMonth(rawMonth) && (
        <p role="alert">Mês inválido. Mostrando o mês atual.</p>
      )}
      <MonthNavigation
        month={month}
        onChange={(m) => navigate(`/transacoes/${m}${location.search}`)}
      />
      <div className="toolbar">
        <div className="add-control">
          <Button disabled={!entryAccount} onClick={() => setAdding(true)}>
            Adicionar em{' '}
            {accounts.find((a) => a.id === entryAccount)?.name ?? 'conta'}
          </Button>
          <select
            aria-label="Escolher conta para adicionar"
            value={entryAccount}
            onChange={(e) => {
              setChosenAccount(e.target.value);
              setAdding(true);
            }}
          >
            <AccountOptions accounts={accounts} />
          </select>
        </div>
        <label className="quick-search">
          <span className="sr-only">Busca rápida</span>
          <input
            type="search"
            placeholder="Buscar beneficiário ou nota"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
              setSelected([]);
            }}
          />
        </label>
        <Button
          aria-expanded={showFilters}
          aria-controls="transaction-filters"
          onClick={() => setShowFilters(!showFilters)}
        >
          Filtros
          {Object.values(filters).filter(Boolean).length
            ? ` (${Object.values(filters).filter(Boolean).length})`
            : ''}
        </Button>
        <details onToggle={positionMenu} className="row-menu">
          <summary>Mais opções</summary>
          <div className="menu-panel">
            <Button onClick={() => setPurchase(true)}>
              Lançar compra parcelada
            </Button>
          </div>
        </details>
      </div>
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
                .filter((a) => !a.closed_at && !a.archived)
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
              setFilters({
                tag: '',
                account: '',
                category: '',
                origin: '',
                from: '',
                to: '',
              });
              setPage(1);
            }}
          >
            Limpar filtros
          </Button>
        </section>
      )}
      <div className="transactions-layout">
        <section className="transactions-main">
          {loading && !data ? (
            <p role="status">Carregando transações…</p>
          ) : error ? (
            <div role="alert" className="error">
              {error}{' '}
              <Button onClick={() => setRetry(retry + 1)}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            data && (
              <>
                <p className="count" role="status">
                  {data.total} transações · Entrada soma ao saldo; saída reduz o
                  saldo.
                </p>
                {!!selected.length && (
                  <BulkTransactions
                    items={data.items.filter((t) => selected.includes(t.id))}
                    categories={categories}
                    tags={tags}
                    onSaved={onSaved}
                    onClear={() => setSelected([])}
                  />
                )}
                <div className="sheet-table">
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
                      'Categoria',
                      'Alocação',
                      'Notas',
                      'Tags',
                      'Origem',
                      'Ações',
                    ]}
                    label="Transações"
                  >
                    <>
                      {adding && (
                        <NewTransactionRow
                          key={month}
                          initialAccount={entryAccount}
                          month={month}
                          accounts={accounts}
                          categories={categories}
                          tags={tags}
                          onSaved={onSaved}
                          onCancel={() => setAdding(false)}
                        />
                      )}
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
                          <td colSpan={11}>
                            Nenhuma transação encontrada para estes filtros.
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
        <MonthSummary month={month} revision={revision} />
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
