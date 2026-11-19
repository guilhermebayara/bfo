import { useEffect, useState, type FormEvent } from 'react';
import type { Named, Payee, Category, Tag } from '../../shared/types';
import { api, humanDate } from '../api';
import { Button, Table } from '../components';
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
        ...(route === 'categories' ? { is_income: income ? 1 : 0 } : {}),
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
    <section className="account-group">
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
          {route === 'categories' && (
            <label>
              <input
                type="checkbox"
                checked={income}
                onChange={(e) => setIncome(e.target.checked)}
              />
              Tratar como renda
            </label>
          )}
          <Button type="submit">
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
      <Table headers={['Nome', 'Detalhe', 'Ação']} label={title}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              {route === 'tags' && (
                <span className="tag-dot" style={{ background: r.color }} />
              )}
              {r.name}
            </td>
            <td>
              {parentField
                ? parents.find(
                    (p) =>
                      p.id ===
                      (r as unknown as Record<string, string>)[parentField],
                  )?.name
                : route === 'allocation-groups'
                  ? `${r.target_percent}%`
                  : r.color}
              {route === 'categories' && r.is_income ? ' · Renda' : ''}
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
                }}
              >
                Editar {r.name}
              </Button>
            </td>
          </tr>
        ))}
      </Table>
    </section>
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
      <h1>Categorias</h1>
      <p>Organize grupos de alocação, grupos de categoria e categorias.</p>
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
      <h1>Tags</h1>
      <p>Use tags para recortes transversais das transações.</p>
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
      <h1>Beneficiários</h1>
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
                <td>{p.name}</td>
                <td>{p.count}</td>
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
