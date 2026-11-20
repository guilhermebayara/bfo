import { useState } from 'react';
import { formatMoney } from '../../shared/money';
import {
  Badge,
  Button,
  ConfirmationNotice,
  Field,
  Menu,
  Modal,
  Notice,
  PageHeader,
  Panel,
  Select,
  SidePanel,
  State,
  Table,
  Truncated,
} from '../components';
import tokenSource from '../tokens.css?raw';

const [primitiveSource, semanticSource] = tokenSource.split(
  '/* Papéis semânticos */',
);
const readTokens = (source: string) =>
  Array.from(source.matchAll(/(--[\w-]+):\s*([^;]+);/g), ([, name, value]) => ({
    name,
    value: value.replace(/\s+/g, ' '),
  }));
const primitives = readTokens(primitiveSource);
const semantic = readTokens(semanticSource);
const colors = new Set(
  primitives
    .filter(({ value }) => value.startsWith('#') || value === 'transparent')
    .map(({ name }) => name),
);

function TokenList({
  tokens,
  title,
}: {
  tokens: typeof primitives;
  title: string;
}) {
  return (
    <Panel>
      <h3>{title}</h3>
      <dl className="token-list">
        {tokens.map(({ name, value }) => {
          const reference = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
          const color =
            colors.has(name) || (reference && colors.has(reference));
          return (
            <div key={name}>
              <dt>
                {color && (
                  <span
                    aria-hidden="true"
                    className="catalog-swatch"
                    style={{ background: `var(${name})` }}
                  />
                )}
                <code>{name}</code>
              </dt>
              <dd className="catalog-token-value">{value}</dd>
            </div>
          );
        })}
      </dl>
    </Panel>
  );
}

export function Foundations() {
  const [modal, setModal] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [retried, setRetried] = useState(false);
  return (
    <>
      <PageHeader
        title="Fundações"
        context="Catálogo interno de tokens, componentes e estados"
        actions={
          <>
            <a className="action-link" href="#tipografia">
              Tipografia
            </a>
            <a className="action-link" href="#componentes">
              Componentes
            </a>
            <a className="action-link" href="#avisos-e-estados">
              Avisos e estados
            </a>
          </>
        }
      />
      <section className="account-group">
        <h2>Tokens</h2>
        <div className="catalog-grid token-grid">
          <TokenList tokens={primitives} title="Primitivos" />
          <TokenList tokens={semantic} title="Papéis semânticos" />
        </div>
      </section>
      <section id="tipografia" className="account-group" tabIndex={-1}>
        <h2>Tipografia e números</h2>
        <Panel className="catalog-stack">
          <span className="catalog-page-text">Título de página</span>
          <span className="catalog-section-text">Título de seção</span>
          <span>Texto de corpo</span>
          <span className="catalog-label-text">Rótulo</span>
          <div className="inline-actions">
            <span className="amount-total amount-in">
              + {formatMoney(145000)} de entrada
            </span>
            <span className="amount-total amount-out">
              − {formatMoney(12690)} de saída
            </span>
            <span className="amount-total amount-transfer">
              {formatMoney(50000)} em transferência
            </span>
          </div>
        </Panel>
      </section>
      <section id="componentes" className="account-group" tabIndex={-1}>
        <h2>Componentes</h2>
        <div className="catalog-grid">
          <Panel>
            <h3>Botões</h3>
            <div className="catalog-stack">
              <div className="inline-actions">
                <Button type="button" variant="primary">
                  Principal
                </Button>
                <Button type="button">Secundário</Button>
                <Button type="button" variant="quiet">
                  Discreto
                </Button>
                <Button type="button" variant="danger">
                  Destrutivo
                </Button>
              </div>
              <div className="inline-actions" aria-label="Botões desabilitados">
                <Button disabled variant="primary">
                  Principal
                </Button>
                <Button disabled>Secundário</Button>
                <Button disabled variant="quiet">
                  Discreto
                </Button>
                <Button disabled variant="danger">
                  Destrutivo
                </Button>
              </div>
              <div className="inline-actions">
                <Button className="catalog-focus">
                  Exemplo de foco visível
                </Button>
              </div>
            </div>
          </Panel>
          <Panel className="catalog-stack">
            <h3>Campos e seletores</h3>
            <label>
              Beneficiário
              <Field placeholder="Buscar beneficiário" />
            </label>
            <label>
              Conta
              <Select defaultValue="">
                <option value="">Escolha</option>
                <option>Conta fictícia</option>
              </Select>
            </label>
            <label>
              Valor inválido
              <Field
                aria-invalid="true"
                aria-describedby="catalog-field-error"
                defaultValue="ABC"
              />
              <small id="catalog-field-error">
                Informe o valor com vírgula nos centavos.
              </small>
            </label>
            <label>
              Conta obrigatória
              <Select aria-invalid="true" defaultValue="">
                <option value="">Escolha</option>
                <option>Conta fictícia</option>
              </Select>
            </label>
            <label>
              Campo desabilitado
              <Field disabled value="Conta fictícia" />
            </label>
            <label>
              Seletor desabilitado
              <Select disabled>
                <option>Conta fictícia</option>
              </Select>
            </label>
          </Panel>
          <Panel>
            <h3>Etiquetas de estado</h3>
            <div className="inline-actions">
              {(
                [
                  'open',
                  'closed',
                  'paid',
                  'imported',
                  'manual',
                  'retroactive',
                  'adjustment',
                ] as const
              ).map((state) => (
                <Badge key={state} state={state} />
              ))}
            </div>
          </Panel>
          <Panel>
            <h3>Painel e painel lateral</h3>
            <SidePanel aria-label="Exemplo de painel lateral">
              <h4>Resumo do mês</h4>
              <dl>
                <dt>Renda</dt>
                <dd>{formatMoney(145000)}</dd>
                <dt>Despesas</dt>
                <dd>{formatMoney(12690)}</dd>
              </dl>
            </SidePanel>
          </Panel>
          <Panel>
            <h3>Menu e modal</h3>
            <div className="inline-actions">
              <Menu trigger="Mais ações" label="Mais ações do catálogo">
                <Button variant="quiet" onClick={() => setModal(true)}>
                  Ver detalhes
                </Button>
              </Menu>
              <Button onClick={() => setModal(true)}>
                Abrir modal de exemplo
              </Button>
            </div>
          </Panel>
          <Panel>
            <h3>Aviso de confirmação</h3>
            <ConfirmationNotice
              confirmLabel="Confirmar exemplo"
              cancelLabel="Cancelar exemplo"
              onConfirm={() => setConfirmation('Exemplo confirmado.')}
              onCancel={() => setConfirmation('Exemplo cancelado.')}
            >
              Excluir o lançamento fictício?
            </ConfirmationNotice>
            {confirmation && (
              <Notice tone="success" role="status">
                {confirmation}
              </Notice>
            )}
          </Panel>
        </div>
      </section>
      <Panel className="account-group">
        <h2>Tabela</h2>
        <Table
          headers={['Beneficiário', 'Estado', 'Valor']}
          widths={['55%', '22%', '23%']}
          numeric={[2]}
          label="Tabela de exemplo"
        >
          <tr>
            <td>
              <Truncated>
                Loja fictícia com nome comprido, disponível por inteiro ao
                passar o mouse
              </Truncated>
            </td>
            <td>
              <Badge state="imported" />
            </td>
            <td className="numeric">{formatMoney(12690)}</td>
          </tr>
          <tr>
            <td>Recebimento fictício</td>
            <td>
              <Badge state="paid" />
            </td>
            <td className="numeric">{formatMoney(145000)}</td>
          </tr>
        </Table>
      </Panel>
      <section id="avisos-e-estados" className="account-group" tabIndex={-1}>
        <h2>Avisos e estados</h2>
        <div className="catalog-grid">
          <State kind="empty">Nenhum lançamento encontrado.</State>
          <State kind="loading">Carregando lançamentos…</State>
          <State
            kind="error"
            action={
              <Button onClick={() => setRetried(true)}>Tentar novamente</Button>
            }
          >
            Erro ao carregar lançamentos.
          </State>
          {retried && (
            <Notice tone="success" role="status">
              Nova tentativa simulada.
            </Notice>
          )}
          <Notice tone="warning">Uma assinatura vence em breve.</Notice>
          <Notice tone="success">Alterações salvas.</Notice>
        </div>
      </section>
      {modal && (
        <Modal title="Modal de exemplo" onClose={() => setModal(false)}>
          <p>Detalhes de um lançamento fictício.</p>
        </Modal>
      )}
    </>
  );
}
