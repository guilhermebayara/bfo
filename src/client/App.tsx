import React, { useEffect, useRef, useState } from 'react';
import { today } from '../shared/dates';
import type { Account, Category, Recurring } from '../shared/types';
import { Button, Notice, State } from './components';
import { TransactionNotice } from './components/TransactionNotice';
import { Foundations } from './screens/Foundations';
import { api } from './api';
import { Privacy, usePrivacy } from './privacy';
import { useTransactionSession } from './transaction-session';
import { Transactions } from './screens/Transactions';
import { RecurringScreen, SubscriptionTypes } from './screens/Recurring';
import { Cards } from './screens/Cards';
import { InstallmentPurchase } from './screens/InstallmentPurchase';
import { Upcoming } from './screens/Upcoming';
import { Accounts } from './screens/Accounts';
import { Categories, Tags, Payees, Preferences } from './screens/Configuration';
const navigation = [
  {
    label: 'Movimento',
    links: [
      ['/transacoes', 'Transações'],
      ['/contas', 'Contas'],
      ['/cartao', 'Cartão'],
      ['/proximos', 'Próximos'],
      ['/recorrentes', 'Recorrentes'],
      ['/assinaturas', 'Assinaturas'],
    ],
  },
  {
    label: 'Cadastros',
    links: [
      ['/categorias', 'Categorias'],
      ['/tags', 'Tags'],
      ['/beneficiarios', 'Beneficiários'],
      ['/tipos-assinatura', 'Tipos de assinatura'],
    ],
  },
  {
    label: 'Aplicativo',
    links: [
      ['/configuracoes', 'Configurações'],
      ['/fundacoes', 'Fundações'],
    ],
  },
];

export function App() {
  const [address, setAddress] = useState(location.pathname + location.search);
  const [path, search = ''] = address.split('?');
  const privacy = usePrivacy();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [renewals, setRenewals] = useState<Recurring[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const loadSequence = useRef(0);
  const main = useRef<HTMLElement>(null);
  const focusMain = useRef(false);
  useEffect(() => {
    if (focusMain.current) {
      focusMain.current = false;
      main.current?.focus();
    }
  }, [path]);
  async function load() {
    const sequence = ++loadSequence.current;
    try {
      setError('');
      const [a, c, subscriptions] = await Promise.all([
        api<Account[]>('/accounts'),
        api<Category[]>('/categories'),
        api<Recurring[]>('/subscriptions'),
      ]);
      if (sequence !== loadSequence.current) return;
      setRenewals(subscriptions.filter((r) => r.renewal_soon));
      setAccounts(a);
      setCategories(c);
      setReady(true);
      setRevision((v) => v + 1);
    } catch (e) {
      if (sequence === loadSequence.current) setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    const onPop = () => setAddress(location.pathname + location.search);
    addEventListener('popstate', onPop);
    let lastDay = today();
    const refreshDay = () => {
      const day = today();
      if (day === lastDay) return false;
      lastDay = day;
      void load();
      return true;
    };
    const timer = setInterval(() => {
      if (refreshDay()) return;
      api<Recurring[]>('/subscriptions')
        .then((rows) => setRenewals(rows.filter((r) => r.renewal_soon)))
        .catch(() => {});
    }, 60_000);
    addEventListener('focus', refreshDay);
    return () => {
      removeEventListener('popstate', onPop);
      removeEventListener('focus', refreshDay);
      clearInterval(timer);
    };
  }, []);
  const transactionSession = useTransactionSession(load);
  function go(to: string, replace = false) {
    if (replace) history.replaceState({}, '', to);
    else history.pushState({}, '', to);
    setAddress(to);
  }
  function navigate(event: React.MouseEvent<HTMLAnchorElement>, to: string) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    if (address !== to) {
      focusMain.current = true;
      window.scrollTo(0, 0);
      go(to);
    }
  }
  const layout = (
    <div className="app">
      <a className="skip" href="#main">
        Pular para o conteúdo
      </a>
      <aside className="app-navigation">
        <div className="brand">BFO</div>
        <nav aria-label="Navegação principal">
          {navigation.map(({ label, links }) => (
            <div className="nav-group" key={label}>
              <h2 className="nav-label">{label}</h2>
              <div className="nav-links">
                {links.map(([url, name]) => {
                  const current =
                    path === url ||
                    (url === '/transacoes' &&
                      (path === '/' || path.startsWith('/transacoes/')));
                  const purchase =
                    url === '/cartao' && path.startsWith('/parceladas/');
                  return (
                    <React.Fragment key={url}>
                      <a
                        href={url}
                        aria-current={current ? 'page' : undefined}
                        onClick={(e) => navigate(e, url)}
                      >
                        {name}
                      </a>
                      {purchase && (
                        <a
                          className="nav-child"
                          href={path}
                          aria-current="page"
                          onClick={(e) => navigate(e, path)}
                        >
                          Compra parcelada
                        </a>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div className="workspace">
        <div className="privacy-control">
          <Button
            variant={privacy.hidden ? 'primary' : 'quiet'}
            aria-pressed={privacy.hidden}
            aria-keyshortcuts={privacy.shortcut}
            onClick={privacy.toggle}
          >
            Ocultar valores
          </Button>
        </div>
        {renewals.length > 0 && (
          <Notice
            tone="warning"
            className="alert-space"
            role="status"
            aria-label="Aviso de renovação"
          >
            Renovações próximas:{' '}
            {renewals.map((r) => (
              <span key={r.id}>
                {r.payee} ({r.renewal_date?.split('-').reverse().join('/')}) ·
                aviso com {r.notice_days} dias{' '}
              </span>
            ))}
            <a href="/assinaturas" onClick={(e) => navigate(e, '/assinaturas')}>
              Ver assinaturas
            </a>
          </Notice>
        )}
        {transactionSession.error && (
          <Notice tone="error" className="alert-space" role="alert">
            {transactionSession.error}
          </Notice>
        )}
        <main id="main" ref={main} tabIndex={-1}>
          {path === '/fundacoes' ? (
            <Foundations />
          ) : error ? (
            <State
              kind="error"
              action={
                <Button onClick={() => void load()}>Tentar novamente</Button>
              }
            >
              {error}
            </State>
          ) : !ready ? (
            <State kind="loading">Carregando contas…</State>
          ) : path === '/recorrentes' || path === '/assinaturas' ? (
            <RecurringScreen
              key={path}
              accounts={accounts}
              categories={categories}
              onSaved={load}
              subscriptions={path === '/assinaturas'}
            />
          ) : path === '/tipos-assinatura' ? (
            <SubscriptionTypes onSaved={load} />
          ) : path === '/proximos' ? (
            <Upcoming revision={revision} />
          ) : path === '/cartao' ? (
            <Cards accounts={accounts} onSaved={load} revision={revision} />
          ) : path.startsWith('/parceladas/') ? (
            <InstallmentPurchase
              key={path}
              id={path.slice('/parceladas/'.length)}
              appRevision={revision}
              onSaved={load}
              accounts={accounts}
            />
          ) : path === '/configuracoes' ? (
            <Preferences accounts={accounts} onSaved={load} />
          ) : path === '/categorias' ? (
            <Categories onSaved={load} />
          ) : path === '/tags' ? (
            <Tags />
          ) : path === '/beneficiarios' ? (
            <Payees />
          ) : path === '/contas' ? (
            <Accounts accounts={accounts} onActivated={load} />
          ) : (
            <Transactions
              path={path}
              urlSearch={search}
              navigate={go}
              accounts={accounts}
              categories={categories}
              revision={revision}
              onSaved={load}
            />
          )}
        </main>
        {transactionSession.notice && (
          <TransactionNotice
            key={transactionSession.notice.id}
            notice={transactionSession.notice}
            busy={transactionSession.busy}
            onUndo={
              transactionSession.latest === transactionSession.notice.id
                ? () =>
                    void transactionSession.reverse(
                      'undo',
                      transactionSession.notice?.id,
                    )
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
  return <Privacy.Provider value={privacy.hidden}>{layout}</Privacy.Provider>;
}
