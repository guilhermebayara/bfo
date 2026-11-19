import { useEffect, useState, type FormEvent } from 'react';
import type { Account, Category, Transaction, Tag } from '../../shared/types';
import { formatMoney } from '../../shared/money';
import {
  Badge,
  Button,
  Table,
  CategoryOptions,
  InstallmentLink,
} from '../components';
import { api, humanDate } from '../api';
import { ManualTransaction } from '../components/ManualTransaction';
function InlineEdit({
  transaction,
  categories,
  onSaved,
}: {
  transaction: Transaction;
  categories: Category[];
  onSaved: (category: string) => void;
}) {
  const [category, setCategory] = useState(transaction.category_id ?? '');
  const [note, setNote] = useState(transaction.note);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState({
    category: transaction.category_id ?? '',
    note: transaction.note,
  });
  const categoryLocked =
    transaction.kind === 'card_payment' ||
    (transaction.origin === 'adjustment' && transaction.statement_id);
  const dirty = category !== saved.category || note !== saved.note;
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await api(`/transactions/${transaction.id}`, {
        method: 'PATCH',
        body: JSON.stringify(
          categoryLocked ? { note } : { category_id: category || null, note },
        ),
      });
      setSaved({ category, note });
      setMessage('Salvo.');
      onSaved(category);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="inline-edit">
      {categoryLocked ? (
        (categories.find((c) => c.id === category)?.name ?? 'Sem categoria')
      ) : (
        <>
          <label className="sr-only" htmlFor={`category-${transaction.id}`}>
            Categoria de {transaction.payee}
          </label>
          <select
            id={`category-${transaction.id}`}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setMessage('');
            }}
            disabled={busy}
          >
            <option value="">Sem categoria</option>
            <CategoryOptions categories={categories} />
          </select>
        </>
      )}
      <label className="sr-only" htmlFor={`note-${transaction.id}`}>
        Nota de {transaction.payee}
      </label>
      <input
        id={`note-${transaction.id}`}
        aria-label={`Nota de ${transaction.payee}`}
        placeholder="Adicionar nota"
        value={note}
        maxLength={2000}
        disabled={busy}
        onChange={(e) => {
          setNote(e.target.value);
          setMessage('');
        }}
      />
      <Button type="submit" disabled={!dirty || busy}>
        {busy ? 'Salvando…' : 'Salvar'}
      </Button>
      <small role="status">{message}</small>
    </form>
  );
}
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
}: {
  accounts: Account[];
  categories: Category[];
  revision: number;
  onSaved: () => Promise<void>;
}) {
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
            Histórico por conta. Edite a categoria e a nota na própria tabela.
          </p>
        </div>
      </div>
      <ManualTransaction
        accounts={accounts}
        categories={categories}
        onSaved={onSaved}
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
      {loading ? (
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
                'Origem',
              ]}
              label="Transações"
            >
              <>
                {data.items.map((t) => (
                  <tr key={t.id}>
                    <td className="nowrap">{humanDate(t.date)}</td>
                    <td>{t.account_name}</td>
                    <td>
                      {t.payee}
                      <InstallmentLink item={t} />
                      <div>
                        {t.tags.map((tag) => (
                          <span
                            className="badge"
                            key={tag.id}
                            style={{ borderColor: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td
                      className={`numeric ${t.amount_cents < 0 ? 'income' : ''}`}
                    >
                      <span className="direction">
                        {t.amount_cents < 0 ? 'Entrada (+)' : 'Saída (−)'}
                      </span>
                      {formatMoney(Math.abs(t.amount_cents), t.currency)}
                      {t.currency !== 'BRL' && (
                        <small>
                          {formatMoney(Math.abs(t.amount_brl_cents))}
                        </small>
                      )}
                    </td>
                    <td>
                      <InlineEdit
                        key={`${t.id}-${revision}`}
                        transaction={t}
                        categories={categories}
                        onSaved={(category) => {
                          setData((current) =>
                            current
                              ? {
                                  ...current,
                                  items: current.items.map((item) =>
                                    item.id === t.id
                                      ? {
                                          ...item,
                                          category_id: category || null,
                                          allocation_name:
                                            categories.find(
                                              (c) => c.id === category,
                                            )?.allocation_name ?? null,
                                        }
                                      : item,
                                  ),
                                }
                              : current,
                          );
                          if (
                            filters.category &&
                            filters.category !== category
                          ) {
                            if (data.items.length === 1 && page > 1)
                              setPage(page - 1);
                            else setRetry((value) => value + 1);
                          }
                        }}
                      />
                    </td>
                    <td>{t.allocation_name ?? 'Sem alocação'}</td>
                    <td>
                      <Badge origin={t.origin} />
                    </td>
                  </tr>
                ))}
                {!data.items.length && (
                  <tr>
                    <td colSpan={7}>
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
    </>
  );
}
