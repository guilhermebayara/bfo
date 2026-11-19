import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { parseMoney } from '../../shared/money';
import type { Named } from '../../shared/types';
import { CurrencyPicker } from './CurrencyPicker';
import { Button } from './index';
export function CreateAccount({ onSaved }: { onSaved: () => Promise<void> }) {
  const [institutions, setInstitutions] = useState<Named[]>([]);
  const [institution, setInstitution] = useState('');
  const [newInstitution, setNewInstitution] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('checking');
  const [currency, setCurrency] = useState('BRL');
  const [balance, setBalance] = useState('0,00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState('20');
  const [due, setDue] = useState('27');
  useEffect(() => {
    api<Named[]>('/institutions')
      .then(setInstitutions)
      .catch((e) => setError(e.message));
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      let id = institution;
      if (!id) {
        const created = await api<{ id: string }>('/institutions', {
          method: 'POST',
          body: JSON.stringify({ name: newInstitution }),
        });
        id = created.id;
        setInstitutions(await api<Named[]>('/institutions'));
        setInstitution(id);
        setNewInstitution('');
      }
      await api('/accounts', {
        method: 'POST',
        body: JSON.stringify({
          name,
          kind,
          currency,
          institution_id: id,
          opening_balance_cents: parseMoney(balance),
          ...(kind === 'credit_card'
            ? { closing_day: Number(closing), due_day: Number(due) }
            : {}),
        }),
      });
      await onSaved();
      setName('');
      setError('Conta criada e ativa.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Nova conta</summary>
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="filters">
          <label>
            Nome da conta
            <input
              required
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Instituição
            <select
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            >
              <option value="">Nova instituição</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
          {!institution && (
            <label>
              Nome da instituição
              <input
                required
                value={newInstitution}
                onChange={(e) => setNewInstitution(e.target.value)}
              />
            </label>
          )}
          <label>
            Tipo
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="checking">Conta corrente</option>
              <option value="credit_card">Cartão</option>
              <option value="cash">Dinheiro</option>
            </select>
          </label>
          <label>
            Moeda
            <CurrencyPicker value={currency} onChange={setCurrency} />
          </label>
          <label>
            Saldo inicial ({currency})
            <input
              required
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
            <small>
              Saldo ao final de ontem. Lançamentos de hoje entram sobre essa
              base.
            </small>
          </label>
          {kind === 'credit_card' && (
            <>
              <label>
                Dia de fechamento
                <input
                  required
                  type="number"
                  min="1"
                  max="31"
                  value={closing}
                  onChange={(e) => setClosing(e.target.value)}
                />
              </label>
              <label>
                Dia de vencimento
                <input
                  required
                  type="number"
                  min="1"
                  max="31"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </label>
            </>
          )}
          <Button type="submit">Criar conta ativa</Button>
        </fieldset>
        <p role="status">{error}</p>
      </form>
    </details>
  );
}
