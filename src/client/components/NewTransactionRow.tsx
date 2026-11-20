import { positionMenu } from './menu';
import { useEffect, useRef, useState } from 'react';
import type { Account, Category, Tag, Payee } from '../../shared/types';
import { today } from '../../shared/dates';
import { parseMoney, formatMoney, convert } from '../../shared/money';
import { api } from '../api';
import { Button, CategoryOptions } from './index';
import { AccountOptions } from './AccountOptions';
export function NewTransactionRow({
  accounts,
  categories,
  tags,
  initialAccount,
  month,
  onSaved,
  onCancel,
}: {
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  initialAccount: string;
  month: string;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [account, setAccount] = useState(initialAccount),
    [day, setDay] = useState(
      month === today().slice(0, 7) ? today() : `${month}-01`,
    ),
    [payee, setPayee] = useState(''),
    [amount, setAmount] = useState(''),
    [income, setIncome] = useState(false),
    [category, setCategory] = useState(''),
    [note, setNote] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [rate, setRate] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const row = useRef<HTMLTableRowElement>(null),
    input = useRef<HTMLInputElement>(null),
    saving = useRef(false),
    manualCategory = useRef(false),
    manualTags = useRef(false);
  const [payees, setPayees] = useState<Payee[]>([]);
  useEffect(() => {
    const abort = new AbortController();
    api<Payee[]>('/payees', { signal: abort.signal })
      .then(setPayees)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => abort.abort();
  }, []);
  const rateEdited = useRef(false);
  const [fxMessage, setFxMessage] = useState(''),
    [fxBusy, setFxBusy] = useState(false),
    [automatic, setAutomatic] = useState(false);
  const code = accounts.find((a) => a.id === account)?.currency ?? 'BRL';
  const cat = categories.find((c) => c.id === category);
  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    setAccount(initialAccount);
  }, [initialAccount]);
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
        if (!rateEdited.current) {
          setRate(String(q.rate));
          setAutomatic(true);
          setFxMessage('PTAX preenchida. Você pode corrigir a cotação.');
        }
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
          if (!manualCategory.current && s.category_id) {
            setCategory(s.category_id);
            setIncome(
              !!categories.find((c) => c.id === s.category_id)
                ?.effective_income,
            );
          }
          if (!manualTags.current) setSelected(s.tag_ids);
        })
        .catch((e) => {
          if (e.name !== 'AbortError') setError(e.message);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [payee, categories]);
  async function save() {
    if (saving.current || fxBusy) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const value = parseMoney(amount);
      if (value <= 0) throw new Error('Digite um valor positivo, sem sinal.');
      if (!payee.trim()) throw new Error('Informe o beneficiário.');
      await api('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          account_id: account,
          date: day,
          payee,
          amount_cents: value * (income ? -1 : 1),
          category_id: category || null,
          note,
          tag_ids: selected,
          ...(code !== 'BRL' && rate && !automatic
            ? { fx_rate: Number(rate.replace(',', '.')) }
            : {}),
        }),
      });
      await onSaved();
      setPayee('');
      setAmount('');
      setCategory('');
      setNote('');
      setSelected([]);
      setIncome(false);
      manualCategory.current = false;
      manualTags.current = false;
      setError('Lançamento salvo.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      saving.current = false;
      setBusy(false);
      requestAnimationFrame(() => input.current?.focus());
    }
  }
  return (
    <tr
      ref={row}
      className="entry-row"
      data-new-transaction
      aria-label="Novo lançamento"
      onKeyDown={(e) => {
        if (
          e.key === 'Enter' &&
          (e.target as HTMLElement).tagName !== 'BUTTON'
        ) {
          e.preventDefault();
          void save();
        }
        if (
          e.key.startsWith('Arrow') &&
          (e.target as HTMLElement).tagName !== 'SELECT'
        ) {
          const current = (e.target as HTMLElement).closest('td');
          const cells = [...row.current!.querySelectorAll('td')];
          const index = current ? cells.indexOf(current) : -1;
          const target =
            e.key === 'ArrowLeft'
              ? cells[index - 1]
              : e.key === 'ArrowRight'
                ? cells[index + 1]
                : undefined;
          if (target) {
            e.preventDefault();
            (
              target.querySelector<HTMLElement>('input,select') ??
              target.querySelector<HTMLElement>('summary,button')
            )?.focus();
          } else if (e.key === 'ArrowDown' && index > 0 && index < 10) {
            e.preventDefault();
            row.current
              ?.closest('tbody')
              ?.querySelector<HTMLElement>(
                `tr[data-transaction-id] [data-sheet-cell="${index - 1}"]`,
              )
              ?.focus();
          }
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <td>
        <Button
          type="button"
          aria-label="Cancelar novo lançamento"
          onClick={onCancel}
        >
          ×
        </Button>
      </td>
      <td>
        <input
          aria-label="Data"
          disabled={busy}
          required
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </td>
      <td>
        <select
          aria-label="Conta do novo lançamento"
          disabled={busy}
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        >
          <AccountOptions accounts={accounts} />
        </select>
      </td>
      <td>
        <input
          ref={input}
          list="new-transaction-payees"
          aria-label="Beneficiário"
          disabled={busy}
          required
          maxLength={200}
          value={payee}
          onChange={(e) => setPayee(e.target.value)}
        />
        <datalist id="new-transaction-payees">
          {payees.map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
      </td>
      <td>
        <div className="signed-value">
          <span>{code}</span>
          <Button
            type="button"
            disabled={busy}
            aria-label="Inverter sinal do novo lançamento"
            aria-pressed={income}
            onClick={() => setIncome(!income)}
          >
            {income ? '[+]' : '[-]'}
          </Button>
          <input
            aria-label={`Valor (${code})`}
            disabled={busy}
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        {code !== 'BRL' && (
          <details onToggle={positionMenu} className="row-menu fx-menu">
            <summary>Cotação</summary>
            <div className="menu-panel">
              <label>
                Cotação para BRL
                <input
                  value={rate}
                  onChange={(e) => {
                    rateEdited.current = true;
                    setAutomatic(false);
                    setFxBusy(false);
                    setRate(e.target.value);
                  }}
                  placeholder="PTAX automática"
                />
              </label>
              <small role="status">
                {fxBusy ? 'Buscando PTAX…' : fxMessage}
              </small>
              <small>
                {(() => {
                  try {
                    return `Valor em reais: ${formatMoney(convert(parseMoney(amount), Number(rate.replace(',', '.'))))}`;
                  } catch {
                    return '';
                  }
                })()}
              </small>
            </div>
          </details>
        )}
      </td>
      <td>
        <select
          aria-label="Categoria"
          disabled={busy}
          value={category}
          onChange={(e) => {
            manualCategory.current = true;
            setCategory(e.target.value);
            setIncome(
              !!categories.find((c) => c.id === e.target.value)
                ?.effective_income,
            );
          }}
        >
          <option value="">Sem categoria</option>
          <CategoryOptions categories={categories} />
        </select>
      </td>
      <td>
        <span className="cell-value">
          {cat?.effective_exclude_budget
            ? 'Fora do orçamento'
            : (cat?.allocation_name ?? 'Sem alocação')}
        </span>
      </td>
      <td>
        <input
          aria-label="Nota"
          disabled={busy}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </td>
      <td>
        <details onToggle={positionMenu} className="row-menu">
          <summary>
            {selected.length ? `${selected.length} tags` : 'Tags'}
          </summary>
          <div className="menu-panel">
            {tags.map((t) => (
              <label key={t.id} className="tag-choice">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={selected.includes(t.id)}
                  onChange={(e) => {
                    manualTags.current = true;
                    setSelected(
                      e.target.checked
                        ? [...selected, t.id]
                        : selected.filter((id) => id !== t.id),
                    );
                  }}
                />
                {t.name}
              </label>
            ))}
          </div>
        </details>
      </td>
      <td>Manual</td>
      <td>
        <Button
          type="button"
          disabled={busy || fxBusy}
          aria-label="Salvar lançamento"
          onClick={() => void save()}
        >
          ↵
        </Button>
        {error && (
          <span className="cell-message" role="status">
            {error}
          </span>
        )}
      </td>
    </tr>
  );
}
