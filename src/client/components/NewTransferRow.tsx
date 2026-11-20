import { FinancialInput, useMoney } from '../privacy';
import { useEffect, useState } from 'react';
import type { Tag, Account, Statement } from '../../shared/types';
import { today } from '../../shared/dates';
import { parseMoney } from '../../shared/money';
import { api, humanDate } from '../api';
import { Menu, Button } from './index';
export function NewTransferRow({
  accounts,
  tags,
  month,
  initialAccount,
  extraColumn,
  onSaved,
  onCancel,
}: {
  accounts: Account[];
  tags: Tag[];
  month: string;
  initialAccount: string;
  extraColumn: boolean;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const formatMoney = useMoney();
  const active = accounts.filter(
    (a) => !a.closed_at && !a.archived && a.cutoff_date,
  );
  const [source, setSource] = useState(
      active.find((a) => a.id === initialAccount && a.kind !== 'credit_card')
        ?.id ??
        active.find((a) => a.kind === 'checking')?.id ??
        '',
    ),
    [dest, setDest] = useState(''),
    [day, setDay] = useState(
      month === today().slice(0, 7) ? today() : `${month}-01`,
    ),
    [amount, setAmount] = useState(''),
    [note, setNote] = useState(''),
    [selectedTags, setSelectedTags] = useState<string[]>([]),
    [statements, setStatements] = useState<
      (Statement & { paid_cents: number })[]
    >([]),
    [statement, setStatement] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const destination = active.find((a) => a.id === dest),
    origin = active.find((a) => a.id === source),
    card = destination?.kind === 'credit_card';
  const code = (card ? destination : origin)?.currency ?? 'BRL';
  useEffect(() => {
    setStatements([]);
    setStatement('');
    setMessage('');
    if (!card) return;
    const abort = new AbortController();
    api<(Statement & { paid_cents: number })[]>(`/cards/${dest}/statements`, {
      signal: abort.signal,
    })
      .then((rows) => {
        const pending = rows
          .filter(
            (s) =>
              s.status === 'closed' &&
              !s.scheduled_payment_date &&
              (s.remaining_cents ?? 1) > 0,
          )
          .sort((a, b) => a.due_date.localeCompare(b.due_date));
        setStatements(pending);
        setStatement(pending[0]?.id ?? '');
        if (!pending.length)
          setMessage(
            'Nenhuma fatura fechada em aberto. Feche a fatura na tela de Cartão.',
          );
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setMessage(e.message);
      });
    return () => abort.abort();
  }, [dest, card]);
  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const value = parseMoney(amount);
      if (value <= 0) throw new Error('Informe um valor positivo.');
      if (card && !statement) throw new Error('Escolha a fatura.');
      await api(card ? `/statements/${statement}/pay` : '/transfers', {
        method: 'POST',
        body: JSON.stringify({
          account_id: source,
          date: day,
          amount_cents: value,
          note,
          tag_ids: selectedTags,
          ...(!card ? { destination_account_id: dest } : {}),
        }),
      });
      await onSaved();
      setAmount('');
      setNote('');
      setSelectedTags([]);
      setMessage(card ? 'Pagamento registrado.' : 'Transferência salva.');
      if (card) {
        const rows = await api<(Statement & { paid_cents: number })[]>(
          `/cards/${dest}/statements`,
        );
        const pending = rows
          .filter(
            (s) =>
              s.status === 'closed' &&
              !s.scheduled_payment_date &&
              (s.remaining_cents ?? 1) > 0,
          )
          .sort((a, b) => a.due_date.localeCompare(b.due_date));
        setStatements(pending);
        setStatement(
          pending.find((s) => s.id === statement)?.id ?? pending[0]?.id ?? '',
        );
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <tr
      className="entry-row transfer-entry"
      data-new-transfer
      aria-label={card ? 'Novo pagamento de fatura' : 'Nova transferência'}
      onKeyDown={(e) => {
        if (
          e.key === 'Enter' &&
          (e.target as HTMLElement).tagName !== 'BUTTON'
        ) {
          e.preventDefault();
          void save();
        }
        if (e.key === 'Escape') onCancel();
      }}
    >
      <td>
        <Button aria-label="Cancelar transferência" onClick={onCancel}>
          ×
        </Button>
      </td>
      <td>
        <input
          aria-label="Data da transferência"
          type="date"
          value={day}
          disabled={busy}
          onChange={(e) => setDay(e.target.value)}
        />
      </td>
      <td>
        <select
          aria-label="Conta de origem"
          value={source}
          disabled={busy}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">Origem</option>
          {active
            .filter(
              (a) => a.kind === 'checking' || (!card && a.kind === 'cash'),
            )
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
      </td>
      <td>
        <select
          aria-label="Conta de destino"
          value={dest}
          disabled={busy}
          onChange={(e) => setDest(e.target.value)}
        >
          <option value="">Destino →</option>
          {active
            .filter((a) => a.id !== source)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
      </td>
      <td>
        <div className="signed-value">
          <span>{code}</span>
          <FinancialInput
            aria-label={`Valor da transferência (${code})`}
            inputMode="decimal"
            value={amount}
            disabled={busy}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </td>
      {extraColumn && <td data-readonly-column />}
      <td>
        {card ? (
          <select
            aria-label="Fatura a pagar"
            value={statement}
            disabled={busy}
            onChange={(e) => setStatement(e.target.value)}
          >
            <option value="">Escolha a fatura</option>
            {statements.map((s) => (
              <option key={s.id} value={s.id}>
                {humanDate(s.due_date)} ·{' '}
                {formatMoney(
                  (s.bank_amount_cents ?? s.total_cents) - s.paid_cents,
                  code,
                )}
              </option>
            ))}
          </select>
        ) : (
          <span className="cell-value">Transferência</span>
        )}
      </td>
      <td>
        <span className="cell-value">
          {card ? 'Pagamento de fatura' : 'Entre contas'}
        </span>
      </td>
      <td>
        <input
          aria-label="Nota da transferência"
          maxLength={2000}
          value={note}
          disabled={busy}
          onChange={(e) => setNote(e.target.value)}
        />
      </td>
      <td>
        <Menu
          trigger={selectedTags.length ? `${selectedTags.length} tags` : 'Tags'}
        >
          {tags.map((tag) => (
            <label className="tag-choice" key={tag.id}>
              <input
                type="checkbox"
                checked={selectedTags.includes(tag.id)}
                disabled={busy}
                onChange={(e) =>
                  setSelectedTags(
                    e.target.checked
                      ? [...selectedTags, tag.id]
                      : selectedTags.filter((id) => id !== tag.id),
                  )
                }
              />
              {tag.name}
            </label>
          ))}
        </Menu>
      </td>
      <td className="entry-origin">Manual</td>
      <td />
      <td>
        <Button
          aria-label="Salvar transferência"
          disabled={busy}
          onClick={() => void save()}
        >
          ↵
        </Button>
        {message && (
          <span className="cell-message" role="status">
            {message}
          </span>
        )}
      </td>
    </tr>
  );
}
