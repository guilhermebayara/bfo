import { today } from '../../shared/dates';
import { useEffect, useState, type FormEvent } from 'react';
import type { Account, ActivationPreview } from '../../shared/types';
import { formatMoney, parseMoney, convert } from '../../shared/money';
import { Button, MoneyField, Modal, Table } from '../components';
import { api, humanDate } from '../api';
import { Reconcile } from '../components/Reconcile';
import { CurrencyPicker } from '../components/CurrencyPicker';
import { CreateAccount } from '../components/CreateAccount';
function Activate({
  account,
  onClose,
  onActivated,
}: {
  account: Account;
  onClose: () => void;
  onActivated: () => Promise<void>;
}) {
  const [cutoff, setCutoff] = useState(today());
  const [fxRate, setFxRate] = useState('');
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
        ...(fxRate ? { fx_rate: Number(fxRate.replace(',', '.')) } : {}),
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
          {account.currency !== 'BRL' && (
            <label>
              Cotação manual (opcional)
              <input
                value={fxRate}
                onChange={(e) => changed(() => setFxRate(e.target.value))}
              />
              <small>
                PTAX automática; informe uma cotação se a consulta falhar.
              </small>
            </label>
          )}
          <MoneyField
            label={`Saldo de abertura (${account.currency === 'BRL' ? 'R$' : account.currency})`}
            value={opening}
            onChange={(v) => changed(() => setOpening(v))}
          />
        </fieldset>
        {preview && (
          <section className="preview" aria-label="Prévia de ativação">
            <h3>Conferir antes de ativar</h3>
            <dl>
              <dt>Saldo do arquivo no corte</dt>
              <dd>
                {formatMoney(preview.archive_balance_cents, account.currency)}
              </dd>
              <dt>Saldo de abertura informado</dt>
              <dd>
                {formatMoney(preview.opening_balance_cents, account.currency)}
              </dd>
              <dt>Ajuste visível</dt>
              <dd>
                {preview.adjustment_cents > 0
                  ? 'Saída'
                  : preview.adjustment_cents < 0
                    ? 'Entrada'
                    : 'Sem diferença'}
                :{' '}
                {formatMoney(
                  Math.abs(preview.adjustment_cents),
                  account.currency,
                )}
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
export function Accounts({
  accounts,
  onActivated,
}: {
  accounts: Account[];
  onActivated: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Account | null>(null);
  const [editName, setEditName] = useState('');
  const [editCurrency, setEditCurrency] = useState('BRL');
  const [editError, setEditError] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [selected, setSelected] = useState<Account | null>(null);
  const [reconcile, setReconcile] = useState<Account | null>(null);
  const [grouping, setGrouping] = useState('institution');
  const [rates, setRates] = useState<Record<string, number>>({ BRL: 1 });
  useEffect(() => {
    const abort = new AbortController();
    for (const code of new Set(accounts.map((a) => a.currency)))
      if (code !== 'BRL')
        api<{ rate: number }>(`/fx?currency=${code}&date=${today()}`, {
          signal: abort.signal,
        })
          .then((q) => setRates((r) => ({ ...r, [code]: q.rate })))
          .catch(() => {});
    return () => abort.abort();
  }, [accounts]);
  const kindNames = {
    checking: 'Conta corrente',
    credit_card: 'Cartões',
    cash: 'Dinheiro',
  };
  const active = accounts.filter((a) => !a.closed_at && !a.archived);
  const closed = accounts.filter((a) => a.closed_at || a.archived);
  const group = (a: Account) =>
    grouping === 'institution'
      ? (a.institution_name ?? 'Sem instituição')
      : kindNames[a.kind];
  function rows(list: Account[]) {
    return (
      <Table
        headers={['Conta', 'Tipo', 'Estado', 'Saldo', 'Atualizado em', 'Ação']}
        label="Contas"
      >
        {list.map((a) => (
          <tr key={a.id}>
            <td>{a.name}</td>
            <td>{kindNames[a.kind]}</td>
            <td>
              {a.closed_at
                ? `Encerrada em ${humanDate(a.closed_at)}`
                : a.cutoff_date
                  ? `Ativa desde ${humanDate(a.cutoff_date)}`
                  : 'Só arquivo'}
            </td>
            <td className="numeric">
              {formatMoney(a.balance_cents, a.currency)}
              {a.currency !== 'BRL' && (
                <small>
                  {rates[a.currency]
                    ? formatMoney(convert(a.balance_cents, rates[a.currency]))
                    : 'Conversão em reais indisponível'}
                </small>
              )}
            </td>
            <td>
              {a.last_reconciled_at
                ? humanDate(a.last_reconciled_at)
                : 'Ainda não conferida'}
            </td>
            <td>
              <Button
                onClick={() => {
                  setEditing(a);
                  setEditName(a.name);
                  setEditCurrency(a.currency);
                  setEditError('');
                }}
              >
                Editar conta
              </Button>
              {a.kind === 'credit_card' && (
                <p>
                  <a href={`/cartao?account=${encodeURIComponent(a.id)}`}>
                    Ver faturas
                  </a>
                </p>
              )}
              {!a.closed_at &&
                !a.archived &&
                (a.cutoff_date ? (
                  <Button onClick={() => setReconcile(a)}>
                    Conferir saldo
                  </Button>
                ) : (
                  <Button onClick={() => setSelected(a)}>Ativar conta</Button>
                ))}
            </td>
          </tr>
        ))}
      </Table>
    );
  }
  return (
    <>
      <h1>Contas</h1>
      <p>
        Contas importadas ficam como “Só arquivo” até você informar a data de
        corte e o saldo de abertura. Contas criadas aqui já nascem ativas.
      </p>
      <CreateAccount onSaved={onActivated} />
      <label>
        Agrupar por
        <select value={grouping} onChange={(e) => setGrouping(e.target.value)}>
          <option value="institution">Instituição</option>
          <option value="kind">Tipo</option>
        </select>
      </label>
      {[...new Set(active.map(group))].map((name) => {
        const list = active.filter((a) => group(a) === name);
        const complete = list.every((a) => rates[a.currency]);
        const total = list.reduce(
          (n, a) =>
            n +
            (rates[a.currency]
              ? convert(a.balance_cents, rates[a.currency])
              : 0),
          0,
        );
        return (
          <section className="account-group" key={name}>
            <h2>{name}</h2>
            <p>
              Subtotal em reais:{' '}
              {complete
                ? formatMoney(total)
                : 'indisponível enquanto faltar cotação'}
            </p>
            {rows(list)}
          </section>
        );
      })}
      <details>
        <summary>Encerradas ({closed.length})</summary>
        {rows(closed)}
      </details>
      {editing && (
        <Modal
          title={`Editar ${editing.name}`}
          onClose={() => setEditing(null)}
          busy={editBusy}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setEditBusy(true);
              setEditError('');
              try {
                await api(`/accounts/${editing.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({
                    name: editName,
                    currency: editCurrency,
                  }),
                });
                await onActivated();
                setEditing(null);
              } catch (e) {
                setEditError((e as Error).message);
              } finally {
                setEditBusy(false);
              }
            }}
          >
            <fieldset disabled={editBusy}>
              <label>
                Nome da conta
                <input
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </label>
              <label>
                Moeda
                <CurrencyPicker
                  value={editCurrency}
                  onChange={setEditCurrency}
                />
              </label>
              <small>
                Conta com saldo ou histórico mantém a moeda original.
              </small>
              <Button type="submit">Salvar conta</Button>
            </fieldset>
            <p role="alert">{editError}</p>
          </form>
        </Modal>
      )}
      {selected && (
        <Activate
          account={selected}
          onClose={() => setSelected(null)}
          onActivated={onActivated}
        />
      )}
      {reconcile && (
        <Reconcile
          account={reconcile}
          onClose={() => setReconcile(null)}
          onSaved={onActivated}
        />
      )}
    </>
  );
}
