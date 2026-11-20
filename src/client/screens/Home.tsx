import { useEffect, useState } from 'react';
import type {
  AttentionItem,
  HomeData,
  MonthComparison,
  MonthPeriod,
  Projection,
} from '../../shared/home';
import { api, humanDate } from '../api';
import { Button, Notice, PageHeader, Panel, State, Table } from '../components';
import { useMoney } from '../privacy';
import { transactionsUrl } from '../transaction-filters';
import {
  dueComponentUrl,
  dueItemUrl,
  recurringUrl,
  statementUrl,
} from '../upcoming-links';

const projectionFields = {
  saldo: { label: 'Saldo até hoje', amount: 'opening_cents' },
  renda: { label: 'Renda prevista', amount: 'income_cents' },
  'entradas-agendadas': {
    label: 'Entradas agendadas',
    amount: 'scheduled_income_cents',
  },
  saidas: { label: 'Saídas previstas', amount: 'expense_cents' },
  final: { label: 'Saldo no fim da janela', amount: 'ending_cents' },
  minimo: { label: 'Ponto mais baixo', amount: 'low_cents' },
} as const;

type ProjectionView = keyof typeof projectionFields;
export function projectionView(search: string) {
  const value = new URLSearchParams(search).get('projecao');
  return value && Object.hasOwn(projectionFields, value)
    ? (value as ProjectionView)
    : null;
}

function useHome(revision: number) {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    api<HomeData>('/home', { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, [revision, attempt]);
  const retry = (
    <Button onClick={() => setAttempt((n) => n + 1)}>Tentar novamente</Button>
  );
  const state = error ? (
    <State kind="error" action={retry}>
      {error}
    </State>
  ) : (
    <State kind="loading">Carregando números…</State>
  );
  return { data: error ? null : data, state };
}

function AmountLink({
  href,
  label,
  cents,
  currency,
}: {
  href: string;
  label: string;
  cents: number;
  currency?: string;
}) {
  const value = useMoney()(cents, currency);
  return (
    <a href={href} aria-label={`${label}, ${value}`}>
      {value}
    </a>
  );
}

function MissingRates({ projection }: { projection: Projection }) {
  if (!projection.missing_rates.length) return null;
  return (
    <Notice tone="warning">
      Projeção parcial. Falta cotação para {projection.missing_rates.join(', ')}
      .
    </Notice>
  );
}

function attentionLink(item: AttentionItem) {
  switch (item.type) {
    case 'statement':
      return {
        href: statementUrl(item.account_id, item.id),
        reason: 'Fatura a conferir',
      };
    case 'recurring':
      return {
        href: recurringUrl(item.id, item.date),
        reason: 'Recorrente fora da janela',
      };
    case 'renewal':
      return {
        href: `/assinaturas?${new URLSearchParams({ recurring: item.id })}`,
        reason: 'Renovação próxima',
      };
    case 'balance':
      return {
        href: `/contas?${new URLSearchParams({ account: item.id })}`,
        reason: 'Saldo a conferir',
      };
  }
}

function MonthTable({ month }: { month: MonthComparison }) {
  const periodLabel = ({ from, to }: MonthPeriod) =>
    `${humanDate(from)} a ${humanDate(to)}`;
  const groupUrl = (
    { month, from, to }: MonthPeriod,
    summary: string,
    group?: string,
  ) => transactionsUrl(month, { summary, group, from, to });
  return (
    <Table
      label="Comparação mensal"
      headers={[
        'Grupo',
        periodLabel(month.current),
        periodLabel(month.previous),
      ]}
      numeric={[1, 2]}
    >
      {(['expense', 'income'] as const).map((summary) => {
        const groups = month.groups.filter(
          (group) => group.is_income === Number(summary === 'income'),
        );
        const label = summary === 'expense' ? 'Gasto' : 'Renda';
        return (
          <MonthRows
            key={summary}
            month={month}
            groups={groups}
            label={label}
            href={(period, group) => groupUrl(period, summary, group)}
          />
        );
      })}
    </Table>
  );
}

function MonthRows({
  month,
  groups,
  label,
  href,
}: {
  month: MonthComparison;
  groups: MonthComparison['groups'];
  label: string;
  href: (period: MonthPeriod, group?: string) => string;
}) {
  return (
    <>
      <tr>
        <th scope="row">{label}</th>
        <td className="numeric">
          <AmountLink
            href={href(month.current)}
            label={`${label} deste mês`}
            cents={groups.reduce(
              (total, group) => total + group.current_cents,
              0,
            )}
          />
        </td>
        <td className="numeric">
          <AmountLink
            href={href(month.previous)}
            label={`${label} do mês anterior`}
            cents={groups.reduce(
              (total, group) => total + group.previous_cents,
              0,
            )}
          />
        </td>
      </tr>
      {groups.map((group) => (
        <tr key={group.id ?? 'none'}>
          <th scope="row">{group.label}</th>
          <td className="numeric">
            <AmountLink
              href={href(month.current, group.id ?? 'none')}
              label={`${group.label}, ${label.toLowerCase()} deste mês`}
              cents={group.current_cents}
            />
          </td>
          <td className="numeric">
            <AmountLink
              href={href(month.previous, group.id ?? 'none')}
              label={`${group.label}, ${label.toLowerCase()} do mês anterior`}
              cents={group.previous_cents}
            />
          </td>
        </tr>
      ))}
    </>
  );
}

export function Home({ revision }: { revision: number }) {
  const { data, state } = useHome(revision);
  const ready = data !== null;
  useEffect(() => {
    if (ready && location.hash)
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [ready]);
  return (
    <>
      <PageHeader title="Início" context={data && humanDate(data.day)} />
      {data ? (
        <>
          <Panel className="account-group" aria-labelledby="disponivel">
            <h2 id="disponivel">Quanto tenho disponível</h2>
            <p className="section-help">
              Projeção de 30 dias, até {humanDate(data.projection.to)}.
            </p>
            {!data.projection.has_income_recurring && (
              <Notice>
                Projeção sem renda prevista.{' '}
                <a href="/recorrentes">Cadastre um recorrente de renda.</a>
              </Notice>
            )}
            <MissingRates projection={data.projection} />
            <Table
              label="Totais da projeção"
              headers={['Projeção', 'Valor em reais']}
              numeric={[1]}
            >
              {(Object.keys(projectionFields) as ProjectionView[]).map(
                (key) => {
                  if (
                    key === 'entradas-agendadas' &&
                    !data.projection.entries.some(
                      (entry) => entry.kind === 'scheduled_income',
                    )
                  )
                    return null;
                  const { label, amount } = projectionFields[key];
                  return (
                    <tr key={key}>
                      <th scope="row">
                        {label}
                        {key === 'minimo' &&
                          ` em ${humanDate(data.projection.low_date)}`}
                      </th>
                      <td className="numeric">
                        <AmountLink
                          href={`/proximos?projecao=${key}`}
                          label={label}
                          cents={data.projection[amount]}
                        />
                      </td>
                    </tr>
                  );
                },
              )}
            </Table>
          </Panel>
          <Panel className="account-group" aria-labelledby="atencao">
            <h2 id="atencao">O que pede atenção</h2>
            {data.attention.length ? (
              <ul>
                {data.attention.map((item) => {
                  const { href, reason } = attentionLink(item);
                  return (
                    <li key={`${item.type}-${item.id}`}>
                      <a href={href}>
                        {item.label} · {reason}
                      </a>
                      {item.date && ` · ${humanDate(item.date)}`}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <State kind="empty">Tudo em dia.</State>
            )}
          </Panel>
          <Panel className="account-group" aria-labelledby="vence-em-breve">
            <h2 id="vence-em-breve">O que vence em breve</h2>
            <p className="section-help">
              Até {humanDate(data.due.to)}.{' '}
              <a href="/proximos">Ver todos em Próximos.</a>
            </p>
            {data.due.items.length ? (
              <Table
                label="Vencimentos da semana"
                headers={['Data', 'Lançamento', 'Conta', 'Valor']}
                numeric={[3]}
                widths={['16%', '42%', '25%', '17%']}
              >
                {data.due.items.map((item) => (
                  <tr key={item.id}>
                    <td>{humanDate(item.date)}</td>
                    <td>{item.label}</td>
                    <td>{item.account_name}</td>
                    <td className="numeric">
                      <AmountLink
                        href={dueItemUrl(item, true)}
                        label={`Valor de ${item.label}`}
                        cents={item.amount_cents}
                        currency={item.currency}
                      />
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <State kind="empty">Nenhum vencimento nos próximos 7 dias.</State>
            )}
          </Panel>
          <Panel className="account-group" aria-labelledby="andamento-do-mes">
            <h2 id="andamento-do-mes">Como o mês está andando</h2>
            <MonthTable month={data.month} />
          </Panel>
        </>
      ) : (
        state
      )}
    </>
  );
}

export function ProjectionDetails({
  view,
  revision,
}: {
  view: ProjectionView;
  revision: number;
}) {
  const { data, state } = useHome(revision);
  const money = useMoney();
  const field = projectionFields[view];
  const p = data?.projection;
  const runningTotal = view === 'final' || view === 'minimo';
  const balances = view === 'saldo' || runningTotal ? (p?.balances ?? []) : [];
  const entries =
    p?.entries.filter((entry) => {
      switch (view) {
        case 'saldo':
          return false;
        case 'renda':
          return entry.kind === 'income';
        case 'entradas-agendadas':
          return entry.kind === 'scheduled_income';
        case 'saidas':
          return entry.kind === 'expense';
        case 'minimo':
          return !p.low_is_opening && entry.date <= p.low_date;
        case 'final':
          return true;
      }
    }) ?? [];
  return (
    <>
      <PageHeader
        title={field.label}
        context={
          p &&
          `Projeção até ${humanDate(view === 'minimo' ? p.low_date : view === 'saldo' ? data.day : p.to)}`
        }
        actions={<a href="/proximos">Ver Próximos</a>}
      />
      {p ? (
        <Panel aria-label="Detalhamento da projeção">
          <MissingRates projection={p} />
          <p className="section-total">
            Total <strong>{money(p[field.amount])}</strong>
          </p>
          {balances.length || entries.length ? (
            <Table
              label="Valores que formam o total"
              headers={['Data', 'Lançamento', 'Valor']}
              numeric={[2]}
              widths={['18%', '58%', '24%']}
            >
              {balances.map((a) => (
                <tr key={a.id}>
                  <td>{humanDate(data.day)}</td>
                  <td>Saldo até hoje · {a.name}</td>
                  <td className="numeric">
                    <AmountLink
                      href={transactionsUrl(data.day.slice(0, 7), {
                        account: a.id,
                        balance: 'current',
                      })}
                      label={`Saldo de ${a.name}`}
                      cents={a.brl_cents ?? a.balance_cents}
                      currency={a.brl_cents === null ? a.currency : 'BRL'}
                    />
                  </td>
                </tr>
              ))}
              {entries.map(({ item, date, brl_cents, kind }) => (
                <tr key={item.id}>
                  <td>{humanDate(date)}</td>
                  <td>
                    {item.label}
                    {date !== item.date &&
                      ` · previsto em ${humanDate(item.date)}`}
                  </td>
                  <td className="numeric">
                    <AmountLink
                      href={dueItemUrl(item, true)}
                      label={`Valor de ${item.label}`}
                      cents={
                        (brl_cents ?? Math.abs(item.amount_cents)) *
                        (runningTotal && kind === 'expense' ? -1 : 1)
                      }
                      currency={brl_cents === null ? item.currency : 'BRL'}
                    />
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <State kind="empty">Nenhum valor neste total.</State>
          )}
        </Panel>
      ) : (
        state
      )}
    </>
  );
}

export function StatementProjection({
  id,
  revision,
}: {
  id: string;
  revision: number;
}) {
  const { data, state } = useHome(revision);
  const money = useMoney();
  const items = data?.projection.entries.map((entry) => entry.item) ?? [];
  const item = [...items, ...(data?.due.items ?? [])].find(
    (item) => item.type === 'statement' && item.id === id,
  );
  return (
    <details className="panel section-disclosure" open>
      <summary>
        Composição do valor previsto
        {item && ` · ${money(item.amount_cents, item.currency)}`}
      </summary>
      {!data ? (
        state
      ) : item ? (
        <Table
          label="Composição da fatura prevista"
          headers={['Lançamento', 'Valor']}
          numeric={[1]}
        >
          {item.components.map((entry) => {
            const href = dueComponentUrl(item.account_id, entry);
            return (
              <tr key={entry.id}>
                <td>{entry.label}</td>
                <td className="numeric">
                  {href ? (
                    <AmountLink
                      href={href}
                      label={`Valor de ${entry.label}`}
                      cents={entry.amount_cents}
                      currency={item.currency}
                    />
                  ) : (
                    money(entry.amount_cents, item.currency)
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      ) : (
        <State kind="empty">Nenhum valor previsto para esta fatura.</State>
      )}
    </details>
  );
}
