import { useEffect, useState, type FormEvent } from 'react';
import type { Named, Payee, Category, Tag } from '../../shared/types';
import { api, humanDate } from '../api';
import { AccountOptions } from '../components/AccountOptions';
import type { Account } from '../../shared/types';
import {
  Button,
  Notice,
  PageHeader,
  Panel,
  Select,
  State,
  Table,
  Truncated,
} from '../components';
const EMPTY: Named[] = [];
type Row = Named & Partial<Category> & Partial<Tag>;
export function Editor({
  title,
  route,
  parents = EMPTY,
  parentField,
  parentLabel,
  onSaved,
}: {
  title: string;
  route: string;
  parents?: Named[];
  parentField?: string;
  parentLabel?: string;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [parent, setParent] = useState('');
  const [percent, setPercent] = useState('0');
  const [color, setColor] = useState('#888888');
  const [income, setIncome] = useState(false);
  const [excludeBudget, setExcludeBudget] = useState(false);
  const [excludeTotals, setExcludeTotals] = useState(false);
  const flags = route === 'categories' || route === 'category-groups';
  const parentFlags = parents.find((p) => p.id === parent) as Row | undefined;
  const inherited =
    route === 'categories'
      ? {
          inherited_income: parentFlags?.is_income,
          inherited_exclude_budget: parentFlags?.exclude_budget,
          inherited_exclude_totals: parentFlags?.exclude_totals,
        }
      : undefined;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      setRows(await api<Row[]>(`/${route}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [route, parents]);
  function reset() {
    setId('');
    setName('');
    setParent('');
    setPercent('0');
    setColor('#888888');
    setIncome(false);
    setExcludeBudget(false);
    setExcludeTotals(false);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = {
        name,
        ...(parentField ? { [parentField]: parent } : {}),
        ...(route === 'tags' ? { color } : {}),
        ...(route === 'allocation-groups'
          ? { target_percent: Number(percent) }
          : {}),
        ...(flags
          ? {
              is_income: income ? 1 : 0,
              exclude_budget: excludeBudget ? 1 : 0,
              exclude_totals: excludeTotals ? 1 : 0,
            }
          : {}),
      };
      await api(`/${route}${id ? `/${id}` : ''}`, {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(data),
      });
      reset();
      await load();
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel className="account-group">
      <h2>{title}</h2>
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="filters">
          <label>
            Nome
            <input
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {parentField && (
            <label>
              {parentLabel}
              <select
                required
                value={parent}
                onChange={(e) => setParent(e.target.value)}
              >
                <option value="">Escolha</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {route === 'allocation-groups' && (
            <label>
              Percentual previsto
              <input
                required
                type="number"
                min="0"
                max="100"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
              />
            </label>
          )}
          {route === 'tags' && (
            <label>
              Cor
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
          )}
          {flags && (
            <>
              {(
                [
                  [
                    'Tratar como renda',
                    income,
                    setIncome,
                    inherited?.inherited_income,
                  ],
                  [
                    'Fora do orçamento',
                    excludeBudget,
                    setExcludeBudget,
                    inherited?.inherited_exclude_budget,
                  ],
                  [
                    'Fora dos totais',
                    excludeTotals,
                    setExcludeTotals,
                    inherited?.inherited_exclude_totals,
                  ],
                ] as const
              ).map(([label, checked, change, fromGroup]) => (
                <label key={label}>
                  <input
                    type="checkbox"
                    checked={checked || !!fromGroup}
                    disabled={!!fromGroup}
                    onChange={(e) => change(e.target.checked)}
                  />
                  {label}
                  {fromGroup ? ' (herdada do grupo)' : ''}
                </label>
              ))}
            </>
          )}
          <Button variant="primary" type="submit">
            {id ? 'Salvar alterações' : 'Adicionar'}
          </Button>
          {id && (
            <Button type="button" onClick={reset}>
              Cancelar edição
            </Button>
          )}
        </fieldset>
        <p role="alert">{error}</p>
      </form>
      <Table
        headers={['Nome', 'Detalhe', 'Ação']}
        widths={['29%', '53%', '18%']}
        numeric={route === 'allocation-groups' ? [1] : []}
        label={title}
      >
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <div className="table-identity">
                {route === 'tags' && (
                  <span className="tag-dot" style={{ background: r.color }} />
                )}
                <Truncated>{r.name}</Truncated>
              </div>
            </td>
            <td
              className={route === 'allocation-groups' ? 'numeric' : undefined}
            >
              {parentField
                ? parents.find(
                    (p) =>
                      p.id ===
                      (r as unknown as Record<string, string>)[parentField],
                  )?.name
                : route === 'allocation-groups'
                  ? `${r.target_percent}%`
                  : r.color}
              {flags && (
                <>
                  {(r.effective_income ?? r.is_income)
                    ? ` · Renda${r.inherited_income ? ' (herdada)' : ''}`
                    : ''}
                  {(r.effective_exclude_budget ?? r.exclude_budget)
                    ? ` · Fora do orçamento${r.inherited_exclude_budget ? ' (herdada)' : ''}`
                    : ''}
                  {(r.effective_exclude_totals ?? r.exclude_totals)
                    ? ` · Fora dos totais${r.inherited_exclude_totals ? ' (herdada)' : ''}`
                    : ''}
                </>
              )}
            </td>
            <td>
              <Button
                onClick={() => {
                  setId(r.id);
                  setName(r.name);
                  setParent(
                    parentField
                      ? (r as unknown as Record<string, string>)[parentField]
                      : '',
                  );
                  setPercent(String(r.target_percent ?? 0));
                  setColor(r.color ?? '#888888');
                  setIncome(!!r.is_income);
                  setExcludeBudget(!!r.exclude_budget);
                  setExcludeTotals(!!r.exclude_totals);
                }}
              >
                Editar {r.name}
              </Button>
            </td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}
export function Categories({ onSaved }: { onSaved: () => Promise<void> }) {
  const [allocation, setAllocation] = useState<Named[]>([]);
  const [groups, setGroups] = useState<Named[]>([]);
  const [error, setError] = useState('');
  async function load() {
    try {
      const [a, g] = await Promise.all([
        api<Named[]>('/allocation-groups'),
        api<Named[]>('/category-groups'),
      ]);
      setAllocation(a);
      setGroups(g);
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <PageHeader
        title="Categorias"
        context="Grupos de alocação e categorias"
      />
      <p role="alert">{error}</p>
      <Editor
        title="Grupos de alocação"
        route="allocation-groups"
        onSaved={load}
      />
      <Editor
        title="Grupos de categoria"
        route="category-groups"
        parents={allocation}
        parentField="allocation_group_id"
        parentLabel="Grupo de alocação"
        onSaved={load}
      />
      <Editor
        title="Categorias"
        route="categories"
        parents={groups}
        parentField="category_group_id"
        parentLabel="Grupo de categoria"
        onSaved={load}
      />
    </>
  );
}
export function Tags() {
  const saved = () => {};
  return (
    <>
      <PageHeader title="Tags" context="Classificação de transações" />
      <Editor title="Tags cadastradas" route="tags" onSaved={saved} />
    </>
  );
}
export function Payees() {
  const [rows, setRows] = useState<Payee[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    setRows(await api<Payee[]>('/payees'));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function merge(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/payees/merge', {
        method: 'POST',
        body: JSON.stringify({ target_id: target, source_ids: selected }),
      });
      await load();
      setSelected([]);
      setTarget('');
      setError('Nomes unificados. O histórico original foi preservado.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader title="Beneficiários" context="Unificação de nomes" />
      <p>
        Selecione os nomes que serão unificados e escolha o nome de destino. As
        sugestões passam a considerar o histórico conjunto.
      </p>
      <form onSubmit={merge}>
        <fieldset disabled={busy}>
          <label>
            Nome de destino
            <select
              required
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setSelected((s) => s.filter((id) => id !== e.target.value));
              }}
            >
              <option value="">Escolha</option>
              {rows.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={!selected.length || !target}>
            Unificar nomes selecionados
          </Button>
          <Table
            headers={['Selecionar', 'Beneficiário', 'Quantidade', 'Período']}
            widths={['16%', '40%', '15%', '29%']}
            numeric={[2]}
            label="Beneficiários"
          >
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Unificar ${p.name}`}
                    disabled={p.id === target}
                    checked={selected.includes(p.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, p.id]
                          : selected.filter((id) => id !== p.id),
                      )
                    }
                  />
                </td>
                <td>
                  <Truncated>{p.name}</Truncated>
                </td>
                <td className="numeric">{p.count}</td>
                <td>
                  {p.first_date
                    ? `${humanDate(p.first_date)} a ${humanDate(p.last_date!)}`
                    : 'Sem transações'}
                </td>
              </tr>
            ))}
          </Table>
        </fieldset>
      </form>
      <p role="status">{error}</p>
    </>
  );
}

export function Preferences({
  accounts,
  onSaved,
}: {
  accounts: Account[];
  onSaved: () => Promise<void>;
}) {
  const [primary, setPrimary] = useState('BRL'),
    [used, setUsed] = useState<string[]>(['BRL']);
  const names = new Intl.DisplayNames(['pt-BR'], { type: 'currency' });
  const [account, setAccount] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  useEffect(() => {
    api<{
      default_account_id: string | null;
      primary_currency: string;
      currencies_in_use: string[];
    }>('/preferences')
      .then((p) => {
        setAccount(p.default_account_id ?? '');
        setPrimary(p.primary_currency);
        setUsed(p.currencies_in_use);
        setReady(true);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <PageHeader
        title="Configurações"
        context="Preferências de lançamento e moedas"
        actions={
          <Button
            variant="primary"
            type="submit"
            form="preferences"
            disabled={busy || !ready}
          >
            Salvar configurações
          </Button>
        }
      />
      {error && <State kind="error">{error}</State>}
      {!ready && !error && (
        <State kind="loading">Carregando configurações…</State>
      )}
      {message && (
        <Notice tone="success" role="status">
          {message}
        </Notice>
      )}
      <form
        id="preferences"
        hidden={!ready}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          setMessage('');
          try {
            await api('/preferences', {
              method: 'PATCH',
              body: JSON.stringify({
                default_account_id: account || null,
                primary_currency: primary,
                currencies_in_use: used,
              }),
            });
            await onSaved();
            setMessage('Configurações salvas.');
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy || !ready} className="preference-panels">
          <Panel>
            <h2>Lançamentos</h2>
            <label>
              Conta padrão para lançamentos
              <Select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="">Escolher ao lançar</option>
                <AccountOptions accounts={accounts} />
              </Select>
            </label>
          </Panel>
          <Panel>
            <h2>Moedas</h2>
            <label>
              Moeda principal
              <Select
                aria-label="Moeda principal"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
              >
                {used.map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </Select>
              <small>
                Padrão para contas novas. Totais e relatórios em BRL.
              </small>
            </label>
            <fieldset className="currency-options">
              <legend>Moedas em uso</legend>
              {used.map((code) => (
                <label className="tag-choice" key={code}>
                  <input
                    type="checkbox"
                    checked
                    onChange={() => setUsed(used.filter((c) => c !== code))}
                  />
                  {code} · {names.of(code)}
                </label>
              ))}
              <label>
                Adicionar moeda
                <Select
                  aria-label="Adicionar moeda"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setUsed([...used, e.target.value]);
                  }}
                >
                  <option value="">Escolha</option>
                  {Intl.supportedValuesOf('currency')
                    .filter((c) => !used.includes(c))
                    .map((c) => (
                      <option key={c} value={c}>
                        {c} · {names.of(c)}
                      </option>
                    ))}
                </Select>
              </label>
            </fieldset>
          </Panel>
        </fieldset>
      </form>
    </>
  );
}
