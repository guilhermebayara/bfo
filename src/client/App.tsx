import React, { useEffect, useState } from 'react';
import type { Account, Category, Recurring } from '../shared/types';
import { RENEWAL_NOTICE_DAYS } from '../shared/recurring';
import { Button } from './components';
import { api } from './api';
import { Transactions } from './screens/Transactions';
import { RecurringScreen, SubscriptionTypes } from './screens/Recurring';
import { Cards } from './screens/Cards';
import { InstallmentPurchase } from './screens/InstallmentPurchase';
import { Accounts } from './screens/Accounts';
import { Categories, Tags, Payees } from './screens/Configuration';
export function App() {
  const [path, setPath] = useState(location.pathname);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [renewals, setRenewals] = useState<Recurring[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  async function load() {
    try {
      setError('');
      const [a, c, subscriptions] = await Promise.all([
        api<Account[]>('/accounts'),
        api<Category[]>('/categories'),
        api<Recurring[]>('/subscriptions'),
      ]);
      setRenewals(subscriptions.filter((r) => r.renewal_soon));
      setAccounts(a);
      setCategories(c);
      setReady(true);
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    const onPop = () => setPath(location.pathname);
    addEventListener('popstate', onPop);
    const timer = setInterval(() => {
      api<Recurring[]>('/subscriptions')
        .then((rows) => setRenewals(rows.filter((r) => r.renewal_soon)))
        .catch(() => {});
    }, 60_000);
    return () => {
      removeEventListener('popstate', onPop);
      clearInterval(timer);
    };
  }, []);
  function go(to: string, replace = false) {
    if (replace) history.replaceState({}, '', to);
    else history.pushState({}, '', to);
    setPath(to.split('?')[0]);
  }
  function navigate(event: React.MouseEvent<HTMLAnchorElement>, to: string) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    go(to);
  }
  return (
    <div className="app">
      <a className="skip" href="#main">
        Pular para o conteúdo
      </a>
      <aside>
        <div className="brand">
          BFO<small>Finanças pessoais</small>
        </div>
        <nav aria-label="Navegação principal">
          <a
            href="/transacoes"
            aria-current={
              path.startsWith('/transacoes') || path === '/'
                ? 'page'
                : undefined
            }
            onClick={(e) => navigate(e, '/transacoes')}
          >
            Transações
          </a>
          <a
            href="/contas"
            aria-current={path === '/contas' ? 'page' : undefined}
            onClick={(e) => navigate(e, '/contas')}
          >
            Contas
          </a>
          {[
            ['/cartao', 'Cartão'],
            ['/recorrentes', 'Recorrentes'],
            ['/assinaturas', 'Assinaturas'],
            ['/tipos-assinatura', 'Tipos de assinatura'],
            ['/categorias', 'Categorias'],
            ['/tags', 'Tags'],
            ['/beneficiarios', 'Beneficiários'],
          ].map(([url, label]) => (
            <a
              key={url}
              href={url}
              aria-current={path === url ? 'page' : undefined}
              onClick={(e) => navigate(e, url)}
            >
              {label}
            </a>
          ))}
        </nav>
        <p className="environment">Dados fictícios · Sessão E</p>
      </aside>
      <div className="workspace">
        {renewals.length > 0 && (
          <div
            className="alert-space"
            role="status"
            aria-label="Aviso de renovação"
          >
            Renovações nos próximos {RENEWAL_NOTICE_DAYS} dias:{' '}
            {renewals.map((r) => (
              <span key={r.id}>
                {r.payee} ({r.renewal_date?.split('-').reverse().join('/')}
                ){' '}
              </span>
            ))}
            <a href="/assinaturas" onClick={(e) => navigate(e, '/assinaturas')}>
              Ver assinaturas
            </a>
          </div>
        )}
        <main id="main">
          {error ? (
            <div role="alert" className="error">
              {error}{' '}
              <Button onClick={() => void load()}>Tentar novamente</Button>
            </div>
          ) : !ready ? (
            <p role="status">Carregando contas…</p>
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
          ) : path === '/cartao' ? (
            <Cards accounts={accounts} onSaved={load} />
          ) : path.startsWith('/parceladas/') ? (
            <InstallmentPurchase
              key={path}
              id={path.slice('/parceladas/'.length)}
              accounts={accounts}
            />
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
              navigate={go}
              accounts={accounts}
              categories={categories}
              revision={revision}
              onSaved={load}
            />
          )}
        </main>
      </div>
    </div>
  );
}
