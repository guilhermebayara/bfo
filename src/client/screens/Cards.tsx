import { useEffect, useState, type FormEvent } from 'react';
import type {
  Account,
  Statement,
  StatementCheck,
  Transaction,
} from '../../shared/types';
import { formatMoney, parseMoney } from '../../shared/money';
import { api, humanDate } from '../api';
import {
  Button,
  InstallmentLink,
  Modal,
  MoneyField,
  Table,
} from '../components';

type Detail = {
  items: Transaction[];
  checks: StatementCheck[];
  revisions: {
    id: string;
    previous_cents: number;
    current_cents: number;
    bank_amount_cents: number | null;
    created_at: string;
  }[];
};
type Preview = {
  app_amount_cents: number;
  bank_amount_cents: number;
  difference_cents: number;
};

function StatementAction({
  mode,
  statement,
  card,
  accounts,
  onClose,
  onSaved,
}: {
  mode: 'check' | 'pay';
  statement: Statement;
  card: Account;
  accounts: Account[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const checking = accounts.filter(
    (a) =>
      a.kind === 'checking' && a.cutoff_date && !a.closed_at && !a.archived,
  );
  const [sourceId, setSourceId] = useState(
    checking.find((a) => a.currency === card.currency)?.id ??
      checking[0]?.id ??
      '',
  );
  const source = checking.find((a) => a.id === sourceId);
  const [day, setDay] = useState(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
  );
  const [bank, setBank] = useState('');
  const [cardRate, setCardRate] = useState('');
  const [sourceRate, setSourceRate] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pay = mode === 'pay';
  const money = (amount: number) => formatMoney(amount, card.currency);
  const post = (body: object) =>
    api<Preview>(`/statements/${statement.id}/${mode}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  const manualRate = (value: string) => Number(value.replace(',', '.'));
  async function run(event?: FormEvent, search = false) {
    event?.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (pay) {
        await post({
          account_id: sourceId,
          date: day,
          ...(cardRate ? { card_fx_rate: manualRate(cardRate) } : {}),
          ...(sourceRate && source?.currency !== card.currency
            ? { account_fx_rate: manualRate(sourceRate) }
            : {}),
        });
      } else {
        const amount = parseMoney(bank);
        if (!preview) {
          setPreview(await post({ bank_amount_cents: amount }));
          return;
        }
        await post({
          bank_amount_cents: amount,
          expected_total_cents: preview.app_amount_cents,
          action: search ? 'search' : 'close',
          ...(cardRate ? { fx_rate: manualRate(cardRate) } : {}),
        });
      }
      if (search) {
        location.href = `/transacoes/${statement.closing_date.slice(0, 7)}?${new URLSearchParams({ account: card.id, from: statement.period_start, to: statement.closing_date })}`;
        return;
      }
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      if (!pay && (e as Error).message.includes('alterad')) setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={pay ? 'Pagar fatura' : 'Conferir fatura'}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={(event) => void run(event)}>
        <fieldset disabled={busy}>
          {pay ? (
            <>
              <p>
                Valor da fatura{' '}
                {money(statement.bank_amount_cents ?? statement.total_cents)}
              </p>
              {checking.length === 0 && (
                <p>
                  Ative uma conta corrente na tela de Contas para pagar a
                  fatura.
                </p>
              )}
              <label>
                Conta corrente
                <select
                  required
                  value={sourceId}
                  onChange={(e) => {
                    setSourceId(e.target.value);
                    setSourceRate('');
                  }}
                >
                  <option value="">Escolha</option>
                  {checking.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data do pagamento{' '}
                <input
                  required
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </label>
            </>
          ) : (
            <MoneyField
              label={`Valor do banco (${card.currency})`}
              value={bank}
              onChange={(v) => {
                setBank(v);
                setPreview(null);
              }}
            />
          )}
          {preview && (
            <dl className="preview">
              <dt>Total lançado</dt>
              <dd>{money(preview.app_amount_cents)}</dd>
              <dt>Valor do banco</dt>
              <dd>{money(preview.bank_amount_cents)}</dd>
              <dt>Diferença</dt>
              <dd>{money(preview.difference_cents)}</dd>
            </dl>
          )}
          {card.currency !== 'BRL' &&
            (pay || Boolean(preview?.difference_cents)) && (
              <label>
                Cotação do cartão para BRL (opcional)
                <input
                  inputMode="decimal"
                  value={cardRate}
                  onChange={(e) => setCardRate(e.target.value)}
                />
                <small>Se o campo ficar vazio, o app consulta a PTAX.</small>
              </label>
            )}
          {pay &&
            source &&
            source.currency !== 'BRL' &&
            source.currency !== card.currency && (
              <label>
                Cotação da conta corrente para BRL (opcional)
                <input
                  inputMode="decimal"
                  value={sourceRate}
                  onChange={(e) => setSourceRate(e.target.value)}
                />
              </label>
            )}
        </fieldset>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="actions">
          <Button type="button" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          {Boolean(preview?.difference_cents) && (
            <Button
              type="button"
              disabled={busy}
              onClick={() => void run(undefined, true)}
            >
              Procurar compra
            </Button>
          )}
          <Button type="submit" disabled={busy || (pay && !sourceId)}>
            {pay
              ? 'Registrar pagamento'
              : !preview
                ? 'Comparar valores'
                : preview.difference_cents
                  ? 'Fechar com ajuste'
                  : 'Fechar fatura'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const statuses = { open: 'Aberta', closed: 'Fechada', paid: 'Paga' };

export function Cards({
  accounts,
  onSaved,
}: {
  accounts: Account[];
  onSaved: () => Promise<void>;
}) {
  const cards = accounts.filter((a) => a.kind === 'credit_card');
  const [cardId, setCardId] = useState(
    new URLSearchParams(location.search).get('account') ?? '',
  );
  const [selected, setSelected] = useState(
    new URLSearchParams(location.search).get('statement') ?? '',
  );
  const [statements, setStatements] = useState<Statement[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [mode, setMode] = useState<'check' | 'pay' | null>(null);
  const card =
    cards.find((a) => a.id === cardId) ??
    cards.find((a) => !a.archived && !a.closed_at) ??
    cards[0];
  const statement =
    statements.find((s) => s.account_id === card?.id && s.id === selected) ??
    statements.find((s) => s.account_id === card?.id && s.is_current) ??
    statements.find((s) => s.account_id === card?.id);
  const statementId = statement?.id;
  useEffect(() => {
    if (!card) return;
    const abort = new AbortController();
    setError('');
    api<Statement[]>(`/cards/${encodeURIComponent(card.id)}/statements`, {
      signal: abort.signal,
    })
      .then(setStatements)
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [card?.id, revision]);
  useEffect(() => {
    setDetail(null);
    if (!statementId) return;
    const abort = new AbortController();
    api<Detail>(`/statements/${statementId}`, { signal: abort.signal })
      .then(setDetail)
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [statementId, revision]);
  if (!card)
    return (
      <>
        <h1>Cartão</h1>
        <p>
          Cadastre um cartão na tela de <a href="/contas">Contas</a>.
        </p>
      </>
    );
  const money = (amount: number) => formatMoney(amount, card.currency);
  const summary = (label: string, list: Statement[]) =>
    list.length > 0 && (
      <section className="statement-section">
        <h2>{label}</h2>
        <Table
          label={label}
          headers={[
            'Fechamento',
            'Vencimento',
            'Estado',
            'Total',
            'Divergência',
          ]}
        >
          {list.map((s) => (
            <tr key={s.id}>
              <td>
                <Button
                  aria-pressed={s.id === statementId}
                  onClick={() => {
                    if (s.id !== statementId) setDetail(null);
                    setSelected(s.id);
                  }}
                >
                  {humanDate(s.closing_date)}
                </Button>
              </td>
              <td>{humanDate(s.due_date)}</td>
              <td>{statuses[s.status]}</td>
              <td className="numeric">{money(s.total_cents)}</td>
              <td className="numeric">
                {s.difference_cents === null
                  ? 'Sem conferência'
                  : money(s.difference_cents)}
              </td>
            </tr>
          ))}
        </Table>
      </section>
    );
  const list = statements.filter((s) => s.account_id === card.id);
  const current = list.find((s) => s.is_current);
  return (
    <>
      <h1>Cartão</h1>
      <label>
        Cartão
        <select
          value={card.id}
          onChange={(e) => {
            setCardId(e.target.value);
            setSelected('');
            setDetail(null);
          }}
        >
          {cards.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.archived || a.closed_at ? ' (encerrado)' : ''}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {summary('Fatura atual', current ? [current] : [])}
      {summary(
        'Faturas anteriores',
        list.filter(
          (s) =>
            !s.is_current &&
            (!current || s.closing_date < current.closing_date),
        ),
      )}
      {statement && (
        <section className="statement-section">
          <h2>Fatura com vencimento em {humanDate(statement.due_date)}</h2>
          <p>
            Ciclo de {humanDate(statement.period_start)} a{' '}
            {humanDate(statement.closing_date)} · {statuses[statement.status]} ·{' '}
            {money(statement.total_cents)}
          </p>
          {!card.closed_at && !card.archived && statement.status === 'open' && (
            <Button onClick={() => setMode('check')}>Conferir e fechar</Button>
          )}
          {!card.closed_at &&
            !card.archived &&
            statement.status === 'closed' &&
            (statement.bank_amount_cents ?? statement.total_cents) >= 0 && (
              <Button onClick={() => setMode('pay')}>Pagar fatura</Button>
            )}
          {detail && (
            <>
              <h3>Compras do ciclo</h3>
              {detail.items.length ? (
                <Table
                  label="Compras do ciclo"
                  headers={['Data', 'Lançamento', 'Valor']}
                >
                  {detail.items.map((item) => (
                    <tr key={item.id}>
                      <td>{humanDate(item.date)}</td>
                      <td>
                        {item.payee}
                        <InstallmentLink item={item} />
                        {!!item.retroactive && (
                          <small>Retroativa: antes do corte</small>
                        )}
                        {!!item.added_to_closed && (
                          <small>Incluída após o fechamento</small>
                        )}
                      </td>
                      <td className="numeric">
                        {money(item.amount_cents)}
                        {card.currency !== 'BRL' && (
                          <small>{formatMoney(item.amount_brl_cents)}</small>
                        )}
                      </td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <p>Nenhuma compra neste ciclo.</p>
              )}
              {detail.revisions.length > 0 && (
                <>
                  <h3>Alterações após o fechamento</h3>
                  <p>
                    Conferência recalculada. A inclusão das parcelas alterou o
                    total desta fatura. Os valores do banco e os ajustes
                    originais foram preservados.
                  </p>
                  <Table
                    label="Alterações após o fechamento"
                    headers={[
                      'Data',
                      'Total anterior',
                      'Total após inclusão',
                      'Valor do banco',
                      'Diferença após inclusão',
                    ]}
                  >
                    {detail.revisions.map((r) => (
                      <tr key={r.id}>
                        <td>{humanDate(r.created_at.slice(0, 10))}</td>
                        <td>{money(r.previous_cents)}</td>
                        <td>{money(r.current_cents)}</td>
                        <td>
                          {r.bank_amount_cents === null
                            ? 'Sem conferência'
                            : money(r.bank_amount_cents)}
                        </td>
                        <td>
                          {r.bank_amount_cents === null
                            ? 'Sem conferência'
                            : money(r.bank_amount_cents - r.current_cents)}
                        </td>
                      </tr>
                    ))}
                  </Table>
                </>
              )}
              <h3>Histórico de conferência</h3>
              {detail.checks.length ? (
                <Table
                  label="Histórico de conferência"
                  headers={[
                    'Data',
                    'Total lançado',
                    'Valor do banco',
                    'Diferença',
                    'Ação',
                  ]}
                >
                  {detail.checks.map((check) => (
                    <tr key={check.id}>
                      <td>{humanDate(check.created_at.slice(0, 10))}</td>
                      <td>{money(check.app_amount_cents)}</td>
                      <td>{money(check.bank_amount_cents)}</td>
                      <td>
                        {money(
                          check.bank_amount_cents - check.app_amount_cents,
                        )}
                      </td>
                      <td>
                        {check.action === 'search'
                          ? 'Procurar compra'
                          : check.adjustment_transaction_id
                            ? 'Fechada com ajuste'
                            : 'Fechada'}
                      </td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <p>Nenhuma conferência registrada.</p>
              )}
            </>
          )}
        </section>
      )}
      {summary(
        'Faturas futuras',
        list.filter((s) => current && s.closing_date > current.closing_date),
      )}
      {mode && statement && (
        <StatementAction
          key={statement.id}
          mode={mode}
          statement={statement}
          card={card}
          accounts={accounts}
          onClose={() => setMode(null)}
          onSaved={async () => {
            await onSaved();
            setRevision((v) => v + 1);
          }}
        />
      )}
    </>
  );
}
