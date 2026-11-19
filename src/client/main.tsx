import React, { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  Account,
  Category,
  Transaction,
  ActivationPreview,
} from '../shared/types';
import { formatMoney, parseMoney } from '../shared/money';
import { Badge, Button, MoneyField, Modal, Table } from './components';
import './tokens.css';
import './styles.css';
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(body.error ?? 'Não foi possível carregar os dados.');
  return body;
}
const humanDate = (date: string) => date.split('-').reverse().join('/');
function InlineEdit({
  transaction,
  categories,
}: {
  transaction: Transaction;
  categories: Category[];
}) {
  const [category, setCategory] = useState(transaction.category_id ?? '');
  const [note, setNote] = useState(transaction.note);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState({
    category: transaction.category_id ?? '',
    note: transaction.note,
  });
  const dirty = category !== saved.category || note !== saved.note;
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await api(`/transactions/${transaction.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ category_id: category || null, note }),
      });
      setSaved({ category, note });
      setMessage('Salvo.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="inline-edit">
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
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.group_name} / {c.name}
          </option>
        ))}
      </select>
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
function Transactions({
  accounts,
  categories,
  revision,
}: {
  accounts: Account[];
  categories: Category[];
  revision: number;
}) {
  const [filters, setFilters] = useState({
    account: '',
    category: '',
    origin: '',
    from: '',
    to: '',
  });
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
      <div className="notice">
        Lançamento manual completo será incluído na sessão B. Nas importadas,
        valor e data ficam travados.
      </div>
      <section className="filters" aria-label="Filtros de transações">
        <label>
          Conta
          <select
            value={filters.account}
            onChange={(e) => filter('account', e.target.value)}
          >
            <option value="">Todas</option>
            {accounts.map((a) => (
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
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.group_name} / {c.name}
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
                'Categoria e nota',
                'Valor',
                'Origem',
              ]}
              label="Transações"
            >
              <>
                {data.items.map((t) => (
                  <tr key={t.id}>
                    <td className="nowrap">{humanDate(t.date)}</td>
                    <td>{t.account_name}</td>
                    <td>{t.payee}</td>
                    <td>
                      <InlineEdit
                        key={`${t.id}-${revision}`}
                        transaction={t}
                        categories={categories}
                      />
                    </td>
                    <td
                      className={`numeric ${t.amount_cents < 0 ? 'income' : ''}`}
                    >
                      <span className="direction">
                        {t.amount_cents < 0 ? 'Entrada (+)' : 'Saída (−)'}
                      </span>
                      {formatMoney(Math.abs(t.amount_cents))}
                    </td>
                    <td>
                      <Badge origin={t.origin} />
                    </td>
                  </tr>
                ))}
                {!data.items.length && (
                  <tr>
                    <td colSpan={6}>
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
function Activate({
  account,
  onClose,
  onActivated,
}: {
  account: Account;
  onClose: () => void;
  onActivated: () => Promise<void>;
}) {
  const [cutoff, setCutoff] = useState(new Date().toISOString().slice(0, 10));
  const [opening, setOpening] = useState('0,00');
  const [preview, setPreview] = useState<ActivationPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function changed(action: () => void) {
    action();
    setPreview(null);
    setError('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = JSON.stringify({
        cutoff_date: cutoff,
        opening_balance_cents: parseMoney(opening),
      });
      if (!preview) {
        setPreview(
          await api<ActivationPreview>(
            `/accounts/${account.id}/activation-preview`,
            { method: 'POST', body },
          ),
        );
      } else {
        await api(`/accounts/${account.id}/activate`, { method: 'POST', body });
        await onActivated();
        onClose();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Ativar ${account.name}`} onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <p>
          Informe o saldo do extrato ao final da data de corte. Lançamentos a
          partir do dia seguinte entram no novo saldo.
        </p>
        <fieldset disabled={busy}>
          <label>
            Data de corte
            <input
              type="date"
              required
              value={cutoff}
              onChange={(e) => changed(() => setCutoff(e.target.value))}
            />
          </label>
          <MoneyField
            value={opening}
            onChange={(v) => changed(() => setOpening(v))}
          />
        </fieldset>
        {preview && (
          <section className="preview" aria-label="Prévia de ativação">
            <h3>Conferir antes de ativar</h3>
            <dl>
              <dt>Saldo do arquivo no corte</dt>
              <dd>{formatMoney(preview.archive_balance_cents)}</dd>
              <dt>Saldo de abertura informado</dt>
              <dd>{formatMoney(preview.opening_balance_cents)}</dd>
              <dt>Ajuste visível</dt>
              <dd>
                {preview.adjustment_cents > 0
                  ? 'Saída'
                  : preview.adjustment_cents < 0
                    ? 'Entrada'
                    : 'Sem diferença'}
                : {formatMoney(Math.abs(preview.adjustment_cents))}
              </dd>
            </dl>
            <p>
              O ajuste registra a diferença no histórico. A abertura será a base
              do saldo. A ativação só pode ser feita uma vez nesta etapa.
            </p>
          </section>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="actions">
          <Button type="button" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy
              ? 'Processando…'
              : preview
                ? 'Confirmar ativação'
                : 'Ver prévia'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function Accounts({
  accounts,
  onActivated,
}: {
  accounts: Account[];
  onActivated: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Account | null>(null);
  return (
    <>
      <h1>Contas</h1>
      <p>Confira o saldo e ative cada conta com a sua própria data de corte.</p>
      {(['checking', 'credit_card', 'cash'] as const).map((kind) => (
        <section className="account-group" key={kind}>
          <h2>
            {
              {
                checking: 'Conta corrente',
                credit_card: 'Cartões',
                cash: 'Dinheiro',
              }[kind]
            }
          </h2>
          <Table
            headers={['Conta', 'Estado', 'Saldo', 'Ação']}
            label={`Contas: ${kind}`}
          >
            {accounts
              .filter((a) => a.kind === kind)
              .map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.name}
                    {a.archived ? ' (arquivada)' : ''}
                  </td>
                  <td>
                    {a.cutoff_date
                      ? `Ativa desde ${humanDate(a.cutoff_date)}`
                      : 'Só arquivo'}
                  </td>
                  <td className="numeric">{formatMoney(a.balance_cents)}</td>
                  <td>
                    {!a.cutoff_date && !a.archived ? (
                      <Button onClick={() => setSelected(a)}>
                        Ativar conta
                      </Button>
                    ) : (
                      <span>{a.archived ? 'Arquivada' : 'Ativa'}</span>
                    )}
                  </td>
                </tr>
              ))}
          </Table>
        </section>
      ))}
      {selected && (
        <Activate
          account={selected}
          onClose={() => setSelected(null)}
          onActivated={onActivated}
        />
      )}
    </>
  );
}
function App() {
  const [path, setPath] = useState(location.pathname);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  async function load() {
    try {
      setError('');
      const [a, c] = await Promise.all([
        api<Account[]>('/accounts'),
        api<Category[]>('/categories'),
      ]);
      setAccounts(a);
      setCategories(c);
      setReady(true);
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    const onPop = () => setPath(location.pathname);
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);
  function navigate(event: React.MouseEvent<HTMLAnchorElement>, to: string) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    history.pushState({}, '', to);
    setPath(to);
  }
  return (
    <div className="app">
      <a className="skip" href="#main">
        Pular para o conteúdo
      </a>
      <aside>
        <div className="brand">
          BFO<small>Finanças pessoais</small>
        </div>
        <nav aria-label="Navegação principal">
          <a
            href="/transacoes"
            aria-current={path !== '/contas' ? 'page' : undefined}
            onClick={(e) => navigate(e, '/transacoes')}
          >
            Transações
          </a>
          <a
            href="/contas"
            aria-current={path === '/contas' ? 'page' : undefined}
            onClick={(e) => navigate(e, '/contas')}
          >
            Contas
          </a>
          {['Cartão', 'Recorrentes', 'Assinaturas', 'Categorias'].map(
            (label) => (
              <button key={label} disabled>
                {label}
                <small>Em breve</small>
              </button>
            ),
          )}
        </nav>
        <p className="environment">Dados fictícios · Sessão A</p>
      </aside>
      <div className="workspace">
        <div className="alert-space" aria-label="Espaço reservado para avisos">
          Avisos de renovação serão exibidos aqui na etapa de assinaturas.
        </div>
        <main id="main">
          {error ? (
            <div role="alert" className="error">
              {error}{' '}
              <Button onClick={() => void load()}>Tentar novamente</Button>
            </div>
          ) : !ready ? (
            <p role="status">Carregando contas…</p>
          ) : path === '/contas' ? (
            <Accounts accounts={accounts} onActivated={load} />
          ) : (
            <Transactions
              accounts={accounts}
              categories={categories}
              revision={revision}
            />
          )}
        </main>
      </div>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
