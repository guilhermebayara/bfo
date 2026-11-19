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
- [x] Sessão D: cartão, fatura, parceladas, pagar fatura, conferência.
  - Tela de Cartão, compra original com as parcelas, baixa em uma linha e histórico de conferência. Migração e seed fictício seguem os comandos de [Cloudflare](cloudflare.md).
- [x] Sessão E: navegação mês a mês em Transações e lançamento e edição na própria tabela, depois recorrentes, assinaturas e aviso de renovação.
  - Transações abre no mês atual. Setas de mês anterior e próximo, "ir para o mês" e "voltar para este mês" sempre à mão. O mês fica no endereço (ex.: /transacoes/2026-11), para voltar e compartilhar.
  - Linha de lançamento no topo da tabela, com data (calendário), categoria (busca agrupada), beneficiário, valor com moeda, notas, conta e tags, e um botão de adicionar. Enter salva e deixa a linha pronta para o próximo lançamento.
  - Edição na própria linha de qualquer campo permitido, respeitando a trava das importadas.
  - Referência: prints do Lunch Money enviados pelo dono em 19/11.
  - [x] Navegação mensal no endereço, filtros dentro do mês, lançamento completo no topo da tabela com Enter e edição nas células, preservando importadas e faturas fechadas.
  - [x] Recorrentes por mês e categoria, esperado e realizado, criação a partir de transação e edição dos cadastros.
  - [x] Assinaturas por tipo ou alocação, equivalente mensal, tipos editáveis e faixa de renovação.
  - [x] Migração 0004 e seed fictício ampliado, validados em D1 local isolado. Build e 74 testes de API/regras e 14 testes de navegador aprovados.
  - [x] Migração e seed remotos aplicados pelo dono.
- [x] Sessão F: parcelada retroativa, antecipação no cartão com desconto, divisão de transação, prazo de aviso por assinatura (padrão 30 dias). Regras em docs/decisoes.md (Cartão e fatura, Divisão de transação, Recorrentes e assinaturas). A antecipação de empréstimo fica na fase 2.
  - [x] Lançamento pelo valor da parcela, total de parcelas e parcela atual. Todas as parcelas são geradas nos ciclos correspondentes, com resto de centavos na última, marcação antes do corte e histórico de recálculo quando a fatura já está fechada ou paga.
  - [x] Antecipação das próximas parcelas futuras abertas, com uma linha na fatura atual, valor cheio, valor cobrado, desconto e custo real da compra. Parcelas antecipadas ficam no histórico e saem das somas futuras.
  - [x] Divisão por valor ou percentual com categorias, tags e notas próprias; soma obrigatoriamente fechada, filtros pelas partes e opção de desfazer. Valor e data da importada são preservados.
  - [x] Prazo de aviso por assinatura, padrão de 30 dias, editável no cadastro e usado na faixa de renovação.
  - [x] Migração 0005 e seed fictício aplicados e conferidos em `bfo-teste` e `bfo-homologacao`, sem alterações em produção. Exemplos isolados: Cartão de parcelas fictício e Conta de divisão fictícia.
  - [x] Build, 83 testes de API/regras e 18 testes de navegador aprovados. Interface neutra mantida, com os tokens existentes.
- [ ] Ajuste de clareza (revisão da Sessão F pelo dono): o caminho para lançar uma compra parcelada que já começou não está claro. No lançamento, a escolha "parcelado" deve mostrar o campo "parcela atual" com uma explicação curta (a parcela que aparece na fatura deste mês) e uma prévia das parcelas que serão criadas, com as passadas marcadas como retroativas, antes de salvar.
- [ ] Próxima sessão de ajustes: botão de adicionar com conta padrão e seta com contas de movimento agrupadas por tipo (decisões, seção Tabela de transações). Conta padrão nas configurações.
- [ ] Sessão G: script de importação do Lunch Money (API v2), apagar e refazer importação. Construída e testada só com dados simulados; a importação real espera o repositório privado.

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
