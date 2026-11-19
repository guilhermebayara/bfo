import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Account, Category, Tag, Payee } from '../../shared/types';
import { parseMoney, formatMoney } from '../../shared/money';
import { api } from '../api';
import { Button, CategoryOptions } from './index';
export function ManualTransaction({
  accounts,
  categories,
  onSaved,
}: {
  accounts: Account[];
  categories: Category[];
  onSaved: () => Promise<void>;
}) {
  const active = accounts.filter(
    (a) => !a.closed_at && !a.archived && a.cutoff_date,
  );
  const requestedAccount = new URLSearchParams(location.search).get('account');
  const [account, setAccount] = useState(
    active.find((a) => a.id === requestedAccount)?.id ?? active[0]?.id ?? '',
  );
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [income, setIncome] = useState(false);
  const [installments, setInstallments] = useState('1');
  const [payee, setPayee] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const rateEdited = useRef(false);
  const [rate, setRate] = useState('');
  const [automatic, setAutomatic] = useState(false);
  const [fxMessage, setFxMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fxBusy, setFxBusy] = useState(false);
  const currentAccount = accounts.find((a) => a.id === account);
  const code = currentAccount?.currency ?? 'BRL';
  const canInstall = currentAccount?.kind === 'credit_card' && !income;
  useEffect(() => {
    Promise.all([api<Tag[]>('/tags'), api<Payee[]>('/payees')])
      .then(([t, p]) => {
        setTags(t);
        setPayees(p);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    rateEdited.current = false;
    setRate('');
    setAutomatic(false);
    setFxMessage('');
    setFxBusy(false);
    if (code === 'BRL') return;
    const abort = new AbortController();
    setFxBusy(true);
    api<{ rate: number }>(`/fx?currency=${code}&date=${day}`, {
      signal: abort.signal,
    })
      .then((q) => {
        if (rateEdited.current) return;
        setRate(String(q.rate));
        setAutomatic(true);
        setFxMessage('PTAX preenchida. Você pode corrigir a cotação.');
      })
      .catch((e) => {
        if (e.name !== 'AbortError' && !rateEdited.current)
          setFxMessage('PTAX indisponível. Preencha a cotação manualmente.');
      })
      .finally(() => {
        if (!abort.signal.aborted) setFxBusy(false);
      });
    return () => abort.abort();
  }, [code, day]);
  useEffect(() => {
    if (!payee.trim()) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      api<{ category_id: string | null; tag_ids: string[] }>(
        `/payees/suggestion?name=${encodeURIComponent(payee)}`,
        { signal: abort.signal },
      )
        .then((s) => {
          setCategory(s.category_id ?? '');
          setSelected(s.tag_ids);
        })
        .catch((e) => {
          if (e.name !== 'AbortError') setError(e.message);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [payee]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const value = parseMoney(amount);
      if (value <= 0)
        throw new Error(
          'Informe um valor positivo e escolha entrada ou saída.',
        );
      await api('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          account_id: account,
          date: day,
          amount_cents: income ? -value : value,
          payee,
          category_id: category || null,
          note,
          tag_ids: selected,
          ...(canInstall ? { installment_count: Number(installments) } : {}),
          ...(code !== 'BRL' && !automatic
            ? { fx_rate: Number(rate.replace(',', '.')) }
            : {}),
        }),
      });
      await onSaved();
      setAmount('');
      setInstallments('1');
      setNote('');
      setError('Lançamento salvo.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  let brl = '';
  try {
    if (rate && Number.isFinite(Number(rate.replace(',', '.'))))
      brl = formatMoney(
        Math.round(parseMoney(amount) * Number(rate.replace(',', '.'))),
      );
  } catch {}
  return (
    <details className="manual">
      <summary>Lançar transação</summary>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="filters">
            <label>
              Conta
              <select
                required
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="">Escolha</option>
                {active.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Data
              <input
                required
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </label>
            <label>
              Beneficiário
              <input
                required
                maxLength={200}
                aria-label="Beneficiário"
                list="payees"
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
              />
              <datalist id="payees">
                {payees.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
              <small>Sugere a categoria e as tags do último lançamento.</small>
            </label>
            <label>
              {canInstall && Number(installments) > 1 ? 'Valor total' : 'Valor'}{' '}
              ({code})
              <input
                required
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Direção
              <select
                value={income ? 'income' : 'expense'}
                onChange={(e) => setIncome(e.target.value === 'income')}
              >
                <option value="expense">Saída</option>
                <option value="income">Entrada</option>
              </select>
            </label>
            {canInstall && (
              <label>
                Parcelas
                <input
                  required
                  type="number"
                  min="1"
                  max="120"
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                />
              </label>
            )}
            <label>
              Categoria
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Sem categoria</option>
                <CategoryOptions categories={categories} />
              </select>
            </label>
            {code !== 'BRL' && (
              <label>
                Cotação para BRL
                <input
                  required
                  inputMode="decimal"
                  value={rate}
                  onChange={(e) => {
                    rateEdited.current = true;
                    setFxBusy(false);
                    setFxMessage('Cotação manual.');
                    setRate(e.target.value);
                    setAutomatic(false);
                  }}
                />
                <small role="status">
                  {fxBusy ? 'Buscando PTAX…' : fxMessage}{' '}
                  {brl && `Valor em reais: ${brl}`}
                </small>
              </label>
            )}
            <label>
              Nota
              <input
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
          <fieldset className="tag-list">
            <legend>Tags</legend>
            {tags.map((t) => (
              <label className="tag-choice" key={t.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(t.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, t.id]
                        : selected.filter((id) => id !== t.id),
                    )
                  }
                />
                {t.name}
              </label>
            ))}
          </fieldset>
          <Button type="submit" disabled={fxBusy || !active.length}>
            Salvar lançamento
          </Button>
        </fieldset>
        <p role="status">{error}</p>
      </form>
    </details>
  );
}
