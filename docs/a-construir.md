# A construir

Ordem de construção. Cada sessão marca aqui o que entregou.

## Fase 1: Movimento (brief em docs/briefs/fase-1-movimento.md)

- [x] Sessão A: fundação técnica, seed e interface funcional de Transações e Contas (estrutura e hierarquia, visual neutro).
  - Implementação e validação local concluídas. Publicação e validação remota dependem dos passos em `docs/cloudflare.md`.
- [x] Sessão B: ajustes da revisão da Sessão A e próximo bloco. Detalhe no prompt da sessão. Inclui:
  - Transações: colunas na ordem data, conta, beneficiário, valor, categoria, alocação, origem. Seletor de categoria agrupado (grupo em cima, categorias dentro).
  - Contas: entidade instituição, agrupamento por instituição com subtotal e alternância por tipo, "atualizado em" com a ação Conferir saldo, seção recolhida de encerradas, explicação do estado "só arquivo".
  - Lançamento manual completo com sugestão de categoria e tags pelo beneficiário, categorias e grupos editáveis, tags.
  - Moedas: moeda por conta, valor original e em reais, cotação PTAX automática com correção manual.
  - Front separado em componentes e telas.
  - Migração nova, seed ampliado, testes e configuração de Previews implementados. Migração/seed remotos e configuração do painel seguem os passos em `docs/cloudflare.md`.
- [x] Sessão C: infraestrutura no modelo do acervo da família. Configuração do painel e publicação em [Cloudflare](cloudflare.md).
- [ ] Sessão D: cartão, fatura, parceladas, pagar fatura, conferência.
- [ ] Sessão E: recorrentes, assinaturas, aviso de renovação.
- [ ] Sessão F: script de importação do Lunch Money (API v2), apagar e refazer importação.

- [ ] Conceito visual: feito no Claude depois que a estrutura da fase 1 estiver redonda. Duas propostas numa prévia, o dono escolhe olhando a tela, e só então o visual é aplicado.

- [x] Ajuste técnico (Sessão B): a Cloudflare trocou as prévias por versão com alias pelo recurso Previews, com comando padrão `npx wrangler preview`. Migrar a configuração (bloco `previews` no ambiente homologacao do wrangler, comando de prévia com o ambiente) e atualizar docs/cloudflare.md com os nomes atuais do painel (Settings > Build, preview builds, Preview command).

## Fase 2: Patrimônio

- [ ] Contas de saldo, atualização mensal, investimentos por tipo, aporte e rendimento, empréstimos, patrimônio líquido ao longo do tempo. Brief a escrever quando a fase 1 estiver redonda.

## Fase 3: Orçamento

- [ ] Orçamento por categoria e por grupo, alocação por percentual, parcelas comprometidas. Brief a escrever quando a fase 2 estiver redonda.

## Produção (depois das três fases)

- [ ] Transferir bayara.design para a conta BFO (exportar registros DNS, importar na conta nova, conferir certificados, manter os registros do portfólio na Vercel). Fazer num momento tranquilo.
- [ ] Ligar bfo.bayara.design ao Worker de produção, com Access.
- [ ] Repositório privado antes do primeiro uso do token real.
- [ ] Importação definitiva e datas de corte de cada conta.
