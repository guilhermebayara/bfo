import { useEffect, useState } from 'react';
import type { Account, Category, Transaction, Tag } from '../../shared/types';
import { Button, Table, CategoryOptions } from '../components';
import { api } from '../api';
import { currentMonth, validMonth } from '../../shared/recurring';
import { MonthNavigation } from '../components/MonthNavigation';
import { SplitTransaction } from '../components/SplitTransaction';
import { TransactionRow } from '../components/TransactionRow';
import { RecurringEditor } from './Recurring';
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
  const [splitting, setSplitting] = useState<Transaction | null>(null);
  const [recurring, setRecurring] = useState<Transaction | null>(null);
  useEffect(() => {
    if (path === '/transacoes' || path === '/')
      navigate(`/transacoes/${month}${location.search}`, true);
    setPage(1);
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
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const query = new URLSearchParams({
    ...filters,
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
      <section className="filters" aria-label="Filtros de transações">
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
      {loading && !data ? (
        <p role="status">Carregando transações…</p>
      ) : error ? (
        <div role="alert" className="error">
          {error}{' '}
          <Button onClick={() => setRetry(retry + 1)}>Tentar novamente</Button>
        </div>
      ) : (
        data && (
          <>
            <p className="count" role="status">
              {data.total} transações · Entrada soma ao saldo; saída reduz o
              saldo.
            </p>
            <Table
              headers={[
                'Data',
                'Conta',
                'Beneficiário',
                'Valor',
                'Categoria',
                'Alocação',
                'Notas / Tags',
                'Origem',
                'Ações',
              ]}
              label="Transações"
            >
              <>
                <ManualTransaction
                  key={month}
                  table
                  month={month}
                  accounts={accounts}
                  categories={categories}
                  onSaved={onSaved}
                />
                {data.items.map((t) => (
                  <TransactionRow
                    key={t.id}
                    t={t}
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
                    <td colSpan={9}>
                      Nenhuma transação encontrada para estes filtros.
                    </td>
                  </tr>
                )}
              </>
            </Table>
            <div className="pagination">
              <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Anterior
              </Button>
              <span>
                Página {page} de{' '}
                {Math.max(1, Math.ceil(data.total / data.page_size))}
              </span>
              <Button
                disabled={page * data.page_size >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Próxima
              </Button>
            </div>
          </>
        )
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
