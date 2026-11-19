import React, { useEffect, useState } from 'react';
import type { Account, Category } from '../shared/types';
import { Button } from './components';
import { api } from './api';
import { Transactions } from './screens/Transactions';
import { Accounts } from './screens/Accounts';
import { Categories, Tags, Payees } from './screens/Configuration';
export function App() {
  const [path, setPath] = useState(location.pathname);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  async function load() {
    try {
      setError('');
      const [a, c] = await Promise.all([
        api<Account[]>('/accounts'),
        api<Category[]>('/categories'),
      ]);
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
    return () => removeEventListener('popstate', onPop);
  }, []);
  function navigate(event: React.MouseEvent<HTMLAnchorElement>, to: string) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    history.pushState({}, '', to);
    setPath(to);
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
              path === '/transacoes' || path === '/' ? 'page' : undefined
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
          {['Cartão', 'Recorrentes', 'Assinaturas'].map((label) => (
            <button key={label} disabled>
              {label}
              <small>Em breve</small>
            </button>
          ))}
        </nav>
        <p className="environment">Dados fictícios · Sessão B</p>
      </aside>
      <div className="workspace">
        <div className="alert-space" aria-label="Espaço reservado para avisos">
          Avisos de renovação serão exibidos aqui na etapa de assinaturas.
        </div>
        <main id="main">
          {error ? (
            <div role="alert" className="error">
              {error}{' '}
              <Button onClick={() => void load()}>Tentar novamente</Button>
            </div>
          ) : !ready ? (
            <p role="status">Carregando contas…</p>
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
