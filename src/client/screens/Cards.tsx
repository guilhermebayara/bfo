import { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  Account,
  Statement,
  StatementCheck,
  Transaction,
} from '../../shared/types';
import { formatMoney, parseMoney } from '../../shared/money';
import { api, humanDate } from '../api';
import {
  Badge,
  Button,
  PageHeader,
  Panel,
  Select,
  State,
  Truncated,
  InstallmentLink,
  Modal,
  MoneyField,
  Table,
} from '../components';

type Detail = {
  items: Transaction[];
  checks: StatementCheck[];
  events: {
    id: string;
    action: string;
    reason: string;
    date: string;
    before_json: string;
    after_json: string;
    created_at: string;
  }[];
  carryovers: {
    source_statement_id: string;
    amount_cents: number;
    due_date: string;
  }[];
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

export type StatementMode = 'check' | 'pay' | 'reopen' | 'early-close';
export function StatementAction({
  mode,
  statement,
  card,
  accounts,
  onClose,
  onSaved,
  onEarlyClosed,
}: {
  onEarlyClosed?: () => void;
  mode: StatementMode;
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
  const [payment, setPayment] = useState(
    String(
      (statement.remaining_cents ??
        (statement.bank_amount_cents ?? statement.total_cents) -
          (statement.paid_cents ?? 0)) / 100,
    ).replace('.', ','),
  );
  const [reason, setReason] = useState('');
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
      if (mode === 'reopen' || mode === 'early-close') {
        await post({ date: day, ...(mode === 'reopen' ? { reason } : {}) });
        await onSaved();
        if (mode === 'early-close' && onEarlyClosed) onEarlyClosed();
        else onClose();
        return;
      }
      if (pay) {
        await post({
          amount_cents: parseMoney(payment),
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
      title={
        mode === 'reopen'
          ? 'Reabrir fatura'
          : mode === 'early-close'
            ? 'Antecipar fechamento'
            : pay
              ? 'Pagar fatura'
              : 'Conferir fatura'
      }
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={(event) => void run(event)}>
        <fieldset disabled={busy}>
          {mode === 'reopen' || mode === 'early-close' ? (
            <>
              <label>
                {mode === 'reopen'
                  ? 'Data da reabertura'
                  : 'Data de fechamento antecipado'}
                <input
                  required
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </label>
              {mode === 'reopen' ? (
                <label>
                  Motivo da reabertura
                  <input
                    required
                    maxLength={2000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
              ) : (
                <p>
                  Compras após essa data vão para a próxima fatura. As datas dos
                  ciclos seguintes são preservadas. Depois, confira o valor do
                  banco para concluir o fechamento.
                </p>
              )}
            </>
          ) : pay ? (
            <>
              <p>
                Saldo a pagar{' '}
                {money(
                  (statement.bank_amount_cents ?? statement.total_cents) -
                    (statement.paid_cents ?? 0),
                )}
              </p>
              <MoneyField
                id="statement-payment"
                label={`Valor do pagamento (${card.currency})`}
                value={payment}
                onChange={setPayment}
              />
              <small>
                No pagamento parcial, o restante será saldo anterior na próxima
                fatura. Juros e encargos devem ser lançados separadamente na
                categoria Tarifas e encargos.
              </small>
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
            {mode === 'reopen'
              ? 'Reabrir fatura'
              : mode === 'early-close'
                ? 'Antecipar e conferir depois'
                : pay
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

function HistoryChanges({
  before,
  after,
  currency,
}: {
  before: string;
  after: string;
  currency: string;
}) {
  const a = JSON.parse(before),
    b = JSON.parse(after),
    original = a.statement ?? a;
  type Item = {
    id: string;
    date?: string;
    data?: string;
    payee?: string;
    beneficiario?: string;
    amount_cents?: number;
    valor?: number;
    category_id?: string;
    categoria?: string;
    note?: string;
    nota?: string;
    tags?: string;
    parts?: string;
  };
  const normalized = (i: Item) => ({
    id: i.id,
    date: i.date ?? i.data,
    payee: i.payee ?? i.beneficiario,
    amount: i.amount_cents ?? i.valor,
    category: i.category_id ?? i.categoria,
    note: i.note ?? i.nota,
    tags: typeof i.tags === 'string' ? i.tags : JSON.stringify(i.tags),
    parts: typeof i.parts === 'string' ? i.parts : JSON.stringify(i.parts),
  });
  const old = (a.items ?? []).map(normalized),
    current = (b.items ?? []).map(normalized);
  const changed = [
    ...new Set([
      ...old.map((i: ReturnType<typeof normalized>) => i.id),
      ...current.map((i: ReturnType<typeof normalized>) => i.id),
    ]),
  ].flatMap((id) => {
    const prev = old.find((i: ReturnType<typeof normalized>) => i.id === id),
      next = current.find((i: ReturnType<typeof normalized>) => i.id === id);
    if (!prev)
      return [
        `${next.payee}: incluída, ${formatMoney(next.amount ?? 0, currency)}`,
      ];
    if (!next)
      return [
        `${prev.payee}: retirada, ${formatMoney(prev.amount ?? 0, currency)}`,
      ];
    const changes = [];
    if (prev.amount !== next.amount)
      changes.push(
        `${formatMoney(prev.amount ?? 0, currency)} → ${formatMoney(next.amount ?? 0, currency)}`,
      );
    if (prev.date !== next.date)
      changes.push(`data: ${humanDate(prev.date)} → ${humanDate(next.date)}`);
    if (prev.payee !== next.payee)
      changes.push(`beneficiário: ${prev.payee} → ${next.payee}`);
    if (prev.category !== next.category) changes.push('categoria alterada');
    if (prev.note !== next.note)
      changes.push(`nota: ${prev.note || 'vazia'} → ${next.note || 'vazia'}`);
    if (prev.tags !== next.tags) changes.push('tags alteradas');
    if (prev.parts !== next.parts) changes.push('divisão alterada');
    return changes.length ? [`${next.payee}: ${changes.join('; ')}`] : [];
  });
  return (
    <>
      <p>
        Total: {formatMoney(original.total_cents ?? 0, currency)} →{' '}
        {formatMoney(b.total_cents ?? 0, currency)}
      </p>
      {original.paid_cents !== b.paid_cents && (
        <p>
          Pago: {formatMoney(original.paid_cents ?? 0, currency)} →{' '}
          {formatMoney(b.paid_cents ?? 0, currency)}
        </p>
      )}
      {original.carried_out_cents !== b.carried_out_cents && (
        <p>
          Transportado: {formatMoney(original.carried_out_cents ?? 0, currency)}{' '}
          → {formatMoney(b.carried_out_cents ?? 0, currency)}
        </p>
      )}
      {original.closing_date !== b.closing_date && (
        <p>
          Fechamento:{' '}
          {original.closing_date
            ? humanDate(original.closing_date)
            : 'Sem data'}{' '}
          → {humanDate(b.closing_date)}
        </p>
      )}
      {changed.length ? (
        <ul>
          {changed.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      ) : (
        <p>
          Compras preservadas. A operação e o motivo ficam registrados acima.
        </p>
      )}
    </>
  );
}

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
  const [loadingStatements, setLoadingStatements] = useState(true);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [mode, setMode] = useState<StatementMode | null>(null);
  const selectedStatementHeading = useRef<HTMLHeadingElement>(null);
  const card =
    cards.find((a) => a.id === cardId) ??
    cards.find((a) => !a.archived && !a.closed_at) ??
    cards[0];
  const statement =
    statements.find((s) => s.account_id === card?.id && s.id === selected) ??
    statements.find((s) => s.account_id === card?.id && s.is_current) ??
    statements.find((s) => s.account_id === card?.id);
  const statementId = statement?.id;
  const [commitment, setCommitment] = useState<{
    committed_cents: number;
    credit_limit_cents: number | null;
    available_cents: number | null;
    recurring_until: string;
  } | null>(null);
  const [limit, setLimit] = useState(''),
    [limitMessage, setLimitMessage] = useState('');
  useEffect(() => {
    setLimit(
      card?.credit_limit_cents == null
        ? ''
        : String(card.credit_limit_cents / 100).replace('.', ','),
    );
    const abort = new AbortController();
    if (card)
      api<typeof commitment>(`/cards/${card.id}/commitment`, {
        signal: abort.signal,
      })
        .then(setCommitment)
        .catch((e) => {
          if (e.name !== 'AbortError') setError(e.message);
        });
    return () => abort.abort();
  }, [card?.id, card?.credit_limit_cents, revision]);
  useEffect(() => {
    if (!card) return;
    const abort = new AbortController();
    setError('');
    setLoadingStatements(true);
    api<Statement[]>(`/cards/${encodeURIComponent(card.id)}/statements`, {
      signal: abort.signal,
    })
      .then(setStatements)
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoadingStatements(false);
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
        <PageHeader title="Cartão" />
        <State
          kind="empty"
          action={
            <a className="action-link" href="/contas">
              Ver Contas
            </a>
          }
        >
          Nenhum cartão cadastrado.
        </State>
      </>
    );
  const money = (amount: number) => formatMoney(amount, card.currency);
  const summary = (label: string, list: Statement[]) =>
    list.length > 0 && (
      <Panel className="statement-section">
        <h2>{label}</h2>
        <Table
          label={label}
          numeric={[3, 4]}
          widths={['20%', '19%', '19%', '20%', '22%']}
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
                    selectedStatementHeading.current?.focus();
                  }}
                >
                  {humanDate(s.closing_date)}
                </Button>
              </td>
              <td>{humanDate(s.due_date)}</td>
              <td>
                <Badge state={s.status} />
              </td>
              <td className="numeric">{money(s.total_cents)}</td>
              <td className="numeric">
                {s.difference_cents === null
                  ? 'Sem conferência'
                  : money(s.difference_cents)}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    );
  const list = statements.filter((s) => s.account_id === card.id);
  const current = list.find((s) => s.is_current);
  return (
    <>
      <PageHeader
        title="Cartão"
        context={
          <>
            <label className="compact-field">
              Cartão
              <Select
                value={card.id}
                onChange={(e) => {
                  setCardId(e.target.value);
                  setCommitment(null);
                  setLoadingStatements(true);
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
              </Select>
            </label>
            {statement && (
              <p>
                Fatura selecionada com vencimento em{' '}
                {humanDate(statement.due_date)}
              </p>
            )}
          </>
        }
        actions={
          statement &&
          !card.closed_at &&
          !card.archived && (
            <>
              {statement.status === 'open' && (
                <>
                  <Button variant="primary" onClick={() => setMode('check')}>
                    Conferir e fechar
                  </Button>
                  <Button onClick={() => setMode('early-close')}>
                    Antecipar fechamento
                  </Button>
                </>
              )}
              {statement.status === 'closed' && (
                <Button onClick={() => setMode('reopen')}>
                  Reabrir fatura
                </Button>
              )}
              {statement.status === 'closed' &&
                (statement.remaining_cents ?? 1) > 0 &&
                (statement.bank_amount_cents ?? statement.total_cents) >= 0 && (
                  <Button variant="primary" onClick={() => setMode('pay')}>
                    Pagar fatura
                  </Button>
                )}
            </>
          )
        }
      />
      {error && <State kind="error">{error}</State>}
      {loadingStatements && <State kind="loading">Carregando faturas…</State>}
      {!loadingStatements && !error && !list.length && (
        <State kind="empty">Nenhuma fatura para este cartão.</State>
      )}
      {statement && (
        <Panel className="statement-section">
          <div className="section-heading">
            <h2 ref={selectedStatementHeading} tabIndex={-1}>
              Fatura com vencimento em {humanDate(statement.due_date)}
            </h2>
            <div className="statement-total">
              <Badge state={statement.status} />
              <strong className="amount-total">
                {money(statement.total_cents)}
              </strong>
            </div>
          </div>
          <p className="section-help">
            Ciclo de {humanDate(statement.period_start)} a{' '}
            {humanDate(statement.closing_date)}
          </p>
          {!!statement.previous_balance_cents && (
            <p>Saldo anterior: {money(statement.previous_balance_cents)}</p>
          )}
          {!!statement.carried_out_cents && (
            <p>
              Saldo transportado para a próxima fatura:{' '}
              {money(statement.carried_out_cents)}
            </p>
          )}
          {!!statement.paid_cents && (
            <p>
              Pago: {money(statement.paid_cents)} · Saldo a pagar:{' '}
              {money(
                statement.remaining_cents ??
                  (statement.bank_amount_cents ?? statement.total_cents) -
                    statement.paid_cents,
              )}
            </p>
          )}
          {!detail && !error && (
            <State kind="loading">Carregando fatura…</State>
          )}
          {detail && (
            <>
              <h3>Compras do ciclo</h3>
              {detail.items.length ? (
                <Table
                  label="Compras do ciclo"
                  numeric={[2]}
                  widths={['18%', '60%', '22%']}
                  headers={['Data', 'Lançamento', 'Valor']}
                >
                  {detail.items.map((item) => (
                    <tr key={item.id}>
                      <td>{humanDate(item.date)}</td>
                      <td>
                        <Truncated>{item.payee}</Truncated>
                        <InstallmentLink item={item} />
                        {!!item.retroactive && (
                          <small>
                            <Badge state="retroactive" />: antes do corte
                          </small>
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
                <State kind="empty">Nenhuma compra neste ciclo.</State>
              )}
              {detail.events?.length > 0 && (
                <>
                  <h3>Histórico da fatura</h3>
                  <Table
                    label="Histórico da fatura"
                    headers={['Data', 'Operação', 'Motivo e alterações']}
                  >
                    {detail.events.map((event) => (
                      <tr key={event.id}>
                        <td>{humanDate(event.date)}</td>
                        <td>
                          {{
                            reopen: 'Reabertura',
                            close: 'Fechamento',
                            'early-close': 'Fechamento antecipado',
                            edit: 'Edição de parcela',
                            cancel: 'Cancelamento',
                            move: 'Mudança de fatura',
                            payment: 'Pagamento',
                          }[event.action] ?? event.action}
                        </td>
                        <td>
                          {event.reason}
                          <details>
                            <summary>Ver o que mudou</summary>
                            <HistoryChanges
                              before={event.before_json}
                              after={event.after_json}
                              currency={card.currency}
                            />
                          </details>
                        </td>
                      </tr>
                    ))}
                  </Table>
                </>
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
                    numeric={[1, 2, 3, 4]}
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
                        <td className="numeric">{money(r.previous_cents)}</td>
                        <td className="numeric">{money(r.current_cents)}</td>
                        <td className="numeric">
                          {r.bank_amount_cents === null
                            ? 'Sem conferência'
                            : money(r.bank_amount_cents)}
                        </td>
                        <td className="numeric">
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
                  numeric={[1, 2, 3]}
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
                      <td className="numeric">
                        {money(check.app_amount_cents)}
                      </td>
                      <td className="numeric">
                        {money(check.bank_amount_cents)}
                      </td>
                      <td className="numeric">
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
                <State kind="empty">Nenhuma conferência registrada.</State>
              )}
            </>
          )}
        </Panel>
      )}
      {commitment && (
        <Panel className="card-commitment" aria-label="Limite do cartão">
          <h2>Compromisso do cartão</h2>
          <div className="commitment-totals">
            <p>
              Comprometido: <strong>{money(commitment.committed_cents)}</strong>
            </p>
            {commitment.credit_limit_cents !== null && (
              <>
                <p>
                  Limite:{' '}
                  <strong>{money(commitment.credit_limit_cents)}</strong>
                </p>
                <p>
                  Disponível:{' '}
                  <strong>{money(commitment.available_cents!)}</strong>
                </p>
              </>
            )}
          </div>
          <small>
            Inclui compras e parcelas lançadas, saldos anteriores e recorrentes
            ainda previstos até {humanDate(commitment.recurring_until)}.
          </small>
          <details>
            <summary>Configurar limite</summary>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setLimitMessage('');
                try {
                  await api(`/accounts/${card.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                      credit_limit_cents: limit.trim()
                        ? parseMoney(limit)
                        : null,
                    }),
                  });
                  await onSaved();
                  setRevision((v) => v + 1);
                  setLimitMessage('Limite salvo.');
                } catch (e) {
                  setLimitMessage((e as Error).message);
                }
              }}
            >
              <label className="compact-field">
                Limite opcional ({card.currency})
                <input
                  inputMode="decimal"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </label>
              <small>Deixe vazio para cartão sem limite definido.</small>
              <Button type="submit">Salvar limite</Button>
              <p role="status">{limitMessage}</p>
            </form>
          </details>
        </Panel>
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
      {summary(
        'Faturas futuras',
        list.filter((s) => current && s.closing_date > current.closing_date),
      )}
      {mode && statement && (
        <StatementAction
          key={statement.id + mode}
          mode={mode}
          onEarlyClosed={() => setMode('check')}
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

export function StatementFromTable({
  transaction,
  accounts,
  mode,
  onClose,
  onSaved,
}: {
  transaction: Transaction;
  accounts: Account[];
  mode: StatementMode;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const card = accounts.find(
    (a) =>
      a.id ===
      (transaction.kind === 'card_payment'
        ? transaction.destination_account_id
        : transaction.account_id),
  );
  const [statement, setStatement] = useState<Statement | null>(null),
    [error, setError] = useState(''),
    [activeMode, setActiveMode] = useState(mode),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    if (card)
      api<Statement[]>(`/cards/${card.id}/statements`, { signal: abort.signal })
        .then((rows) => {
          const st =
            rows.find((s) => s.id === transaction.statement_id) ??
            rows.find(
              (s) =>
                transaction.date >= s.period_start &&
                transaction.date <= s.closing_date,
            );
          if (st) setStatement(st);
          else setError('Fatura não encontrada.');
        })
        .catch((e) => {
          if (e.name !== 'AbortError') setError(e.message);
        });
    return () => abort.abort();
  }, [card?.id, transaction.statement_id, revision]);
  return statement && card ? (
    <StatementAction
      key={activeMode}
      mode={activeMode}
      statement={statement}
      card={card}
      accounts={accounts}
      onClose={onClose}
      onEarlyClosed={() => {
        setRevision((v) => v + 1);
        setActiveMode('check');
      }}
      onSaved={onSaved}
    />
  ) : (
    <Modal title="Fatura" onClose={onClose}>
      <p role="status">{error || 'Carregando fatura...'}</p>
    </Modal>
  );
}
