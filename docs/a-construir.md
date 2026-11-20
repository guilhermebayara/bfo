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
- [x] Ajuste de clareza (concluído na Sessão G, revisão da Sessão F pelo dono): o caminho para lançar uma compra parcelada que já começou não está claro. No lançamento, a escolha "parcelado" deve mostrar o campo "parcela atual" com uma explicação curta (a parcela que aparece na fatura deste mês) e uma prévia das parcelas que serão criadas, com as passadas marcadas como retroativas, antes de salvar.
- [x] Sessão G: revisão de código das sessões A a F, antes da importação real.
  - [x] Revisão das regras financeiras, validação da API, datas em America/Sao_Paulo, índices e migrações, com achados e exemplos em [docs/revisao-codigo.md](revisao-codigo.md).
  - [x] 17 defeitos corrigidos (7 altos, 9 médios, 1 baixo), 97 testes de API/regras/migrações e 28 testes de navegador aprovados. Edição como planilha em Transações, salvamento automático, teclado e atualização das telas dependentes cobertos no navegador.
  - [x] Esclarecimento do dono aplicado: importadas permitem categoria, nota, tags e divisão; valor total e data permanecem travados.
  - [x] Lançamento parcelado com explicação da parcela atual e prévia completa, incluindo as retroativas antes de salvar.
- [x] Sessão H (ajustes): refazer a tabela de Transações como planilha de verdade (uma linha por transação, lançamento como linha no topo com as mesmas colunas, setas de mês), seletor de moeda em vez de texto ao criar conta, janela de recorrentes e antecipação reclassificada (decisões, seções Recorrentes e assinaturas e Cartão e fatura), botão de adicionar com conta padrão e seta com contas de movimento agrupadas por tipo, conta padrão nas configurações, botão de sinal no valor automático pela categoria (decisões, seção Tabela de transações), marcas de categoria com herança do grupo (decisões, seção Categorias e orçamento) resumo lateral do mês sem orçamento (decisões, seção Resumo lateral do mês), transferência em uma linha e seleção múltipla com edição em lote (decisões, seção Tabela de transações).
  - [x] Tabela com nove colunas de conteúdo, linhas de 40 px, reticências, notas e tags separadas, menus de linha e filtros recolhidos. Setas de mês junto ao nome, busca rápida e resumo lateral em reais por grupo e categoria, sem marca de ritmo.
  - [x] Botão de adicionar com conta padrão persistida nas configurações, seletor de contas de movimento por tipo e instituição e linha nova no topo. Enter salva e prepara o próximo lançamento; edição por clique, salvamento ao sair e navegação de teclado preservados. Sinal automático pela categoria, com inversão manual.
  - [x] Transferências agrupadas numa linha com origem e destino, valor neutro e perspectiva da conta filtrada. Seleção por linha ou página com total, média, valor transferido, edição de data, beneficiário e classificação, vínculo com recorrente e exclusão em lote, respeitando campos protegidos.
  - [x] Marcas de renda, fora do orçamento e fora dos totais com herança do grupo, indicação da herança na configuração e aplicação no resumo mensal e na alocação. Saldos continuam considerando toda movimentação.
  - [x] Lista de moedas ao criar e editar contas. Contas com saldo ou histórico preservam a moeda; conta vazia permite a troca. Reconhecimento de recorrentes em até sete dias antes ou depois, no mês previsto e sem duplicar meses. Antecipação distribui o valor pago proporcionalmente entre classificações e tags das parcelas, fechando centavos.
  - [x] Build, 106 testes de API/regras/migrações e 36 testes de navegador aprovados. Print local de Transações com dados fictícios gerado para o relatório.
  - [x] Migração 0007, exemplo fictício de transferência no seed e testes de API e navegador. Seed remoto permanece manual; a migração da prévia é aplicada pelo build da branch.
- [x] Sessão I (ajustes da revisão da H): campo de edição do mesmo tamanho da célula em repouso, hover e edição, inclusive na linha nova (referência: prints do Lunch Money enviados pelo dono em 19/11, nos três estados); criar transferência pela tabela e pagamento de fatura como transferência para cartão (decisões, Tabela de transações); moedas em uso e moeda principal nas configurações; janela do recorrente visível; seed com exemplo de transferência.
  - [x] Editores ocupam a própria célula, com dimensões preservadas em repouso, hover e edição. Linha nova usa a largura das colunas; valor mantém sinal e moeda dentro da célula e categoria/conta usam listas suspensas.
  - [x] “Nova transferência” no topo da seta de adicionar, com origem e destino lado a lado, data e valor. Transferência aparece em uma linha neutra e movimenta os dois saldos.
  - [x] Destino cartão transforma a linha em pagamento de fatura, sugere a fatura fechada mais antiga ainda em aberto e aceita pagamentos parciais. Crédito guarda o valor na moeda do cartão; quitação só ocorre ao completar o total, com proteção contra pagamentos concorrentes acima do saldo.
  - [x] Moeda principal como padrão das contas novas e moedas em uso nas configurações. Seletores de moeda filtrados; moedas de contas existentes e BRL são preservadas. Totais seguem em reais.
  - [x] Janela de reconhecimento de sete dias antes/depois exibida em cada recorrente e assinatura, inclusive quando atravessa o mês.
  - [x] Migração 0008 e seed aplicados em `bfo-teste` e `bfo-homologacao` pela integração Cloudflare. Exemplo de novembro/2026: transferência de R$ 150,00 para Dinheiro fictício H e pagamento de R$ 40,00 no Cartão de pagamento fictício, com R$ 60,00 ainda em aberto. Chaves estrangeiras conferidas sem erros.
  - [x] Build, 111 testes de API/regras/migrações e 41 testes de navegador aprovados, incluindo comparação das dimensões nos três estados, criação de transferência, pagamento parcial pela tabela e filtro de moedas em uso.
  - [x] Continuação concluída na Sessão J: transportar o restante do pagamento parcial como “saldo anterior” na fatura seguinte. O restante agora aparece na fatura seguinte, sem duplicar gasto nem movimentação. Os pagamentos parciais anteriores também foram migrados.
- [x] Sessão J (cartão e parcelas). Primeiro, defeitos e decisões da revisão da I sobre transferência (decisões, Tabela de transações): nota e tags digitadas na linha nova de transferência se perdem ao salvar; a transferência salva fica "Sem categoria" e deve nascer em Transferência, editável; o destino passa para a coluna Beneficiário ("→ Conta B") e a coluna Conta mostra só a origem; o destino aceita qualquer conta ativa, inclusive contas de saldo. Depois: célula de parcelas na linha quando a conta é cartão, ações do menu "..." da linha, editar só esta ou esta e as futuras, cancelar futuras, mover para outra fatura, reabrir fatura, antecipar fechamento, pagamento parcial com saldo anterior, limite do cartão com comprometido e disponível, painel Próximos. Regras em docs/decisoes.md, seção Cartão e fatura. Referência: docs/referencia-brasileiros.md.
  - [x] Transferência preserva nota e tags, nasce na categoria Transferência editável e mantém a classificação nos dois lados. Conta mostra a origem; Beneficiário mostra o destino. Destinos ativos incluem investimento, imóvel e empréstimo, sem abrir as funções patrimoniais da fase 2.
  - [x] Parcelas na linha nova de cartão, 1x como padrão, valor total ou da parcela, parcela atual e prévia calculada pela API. Menu da linha permite dividir, antecipar, mover para a fatura anterior ou seguinte, cancelar futuras e criar recorrente. Edição da parcela pede só esta ou esta e as futuras.
  - [x] Reabertura com motivo e data, nova conferência ao fechar e histórico com valores e compras antes/depois. Fechamento antecipado pela tabela ou Cartão encaminha para a conferência e preserva fechamento/vencimento dos próximos ciclos.
  - [x] Pagamento parcial transporta o restante como saldo anterior, com juros e encargos separados na categoria Tarifas e encargos. Contas e totais não duplicam o saldo transportado. Alterações em faturas dependentes exigem reabrir primeiro o ciclo seguinte.
  - [x] Limite opcional no cadastro e na tela Cartão, comprometido e disponível; sem limite definido, só o comprometido. Recorrentes são previstos até o último ciclo cadastrado, com mínimo até o fim do próximo mês; o horizonte fica visível na tela.
  - [x] Próximos mostra o restante do mês e o próximo, com recorrentes reconhecidos retirados da previsão. Parcelas, compras e recorrentes do cartão aparecem dentro da fatura, sem dupla contagem.
  - [x] Migração 0009 e seed fictício aplicados em `bfo-teste` e `bfo-homologacao` pela integração Cloudflare; referências verificadas sem erros. Exemplos: Cartão com limite fictício J, Cartão sem limite fictício J, compra Computador parcelado fictício J, fatura reaberta de novembro, fechamento antecipado de outubro, pagamento parcial e saldo anterior em dezembro, aporte no Investimento fictício J. Produção preservada.
  - [x] Build, 127 testes de API/regras/migrações e 46 testes de navegador aprovados. Detalhes de validação e caminhos em [docs/sessao-j.md](sessao-j.md).
- [x] Sessão K: script de importação do Lunch Money (API v2), apagar e refazer importação. Construída e testada só com dados simulados; a importação real espera o repositório privado.
  - [x] Dados simulados da API v2 prontos em `tests/fixtures/lunchmoney/` (um JSON por endpoint, transações em duas páginas, casos de borda descritos no `LEIA-ME.md`).
  - [x] Migração 0010, mapeamento e testes de cada linha do LEIA-ME, inclusive apagar e refazer e a segunda carga sem duplicar. Validado no D1 local. A carga em `bfo-teste` fica no comando de [docs/importacao.md](importacao.md), porque esta máquina não tem credencial da Cloudflare.
  - [x] Script `coletar`, `carregar` e `apagar`. O token é digitado na hora. O arquivo da coleta fica em `private-data/`, fora do Git.
  - [x] Build e 158 testes de API/regras aprovados. 47 de 48 testes de navegador aprovados. O que falhou é o pagamento parcial da Sessão I quando o calendário cai no dia de fechamento 20.

- [x] Sessão L (fundações de layout, antes do conceito): pedido do dono em 19/11/2026, porque a interface básica demais dificulta testar. Continua neutra, sem identidade visual. Tokens em duas camadas (primitivos e papéis semânticos), escalas de tipografia, espaço, superfície e borda, números tabulares e valores alinhados à direita, estrutura da aplicação com navegação e cabeçalho de página padrão, componentes base reutilizáveis, estados vazio, carregando e erro, uma página de catálogo das fundações e revisão da hierarquia de cada tela. Sem regra nova e sem funcionalidade nova. Referências guardadas em docs/referencia-visual.md, para o conceito.
  - [x] Navegação, cabeçalhos e hierarquia das telas revisados. Tokens, componentes e estados catalogados em `/fundacoes`.
  - [x] Testes de navegador cobrem a navegação, o catálogo e a geometria das células da planilha.

- [ ] Defeito encontrado na Sessão K, para a sessão de correção depois da QA: tests/browser/session-i.spec.ts (pagamento parcial pela tabela) depende da data do dia e quebra no dia 20, fechamento da fatura do seed. Os testes de navegador precisam de data fixa.
- [x] Ajustes da revisão da Sessão L (pelo dono em 20/11/2026), para a sessão de correção depois da QA: resumo do mês em Transações recolhível, ao lado quando houver espaço, para a tabela ganhar largura; no Cartão, a fatura selecionada e as compras do ciclo vêm antes da lista de faturas; na navegação, os títulos dos grupos (Movimento, Cadastros, Aplicativo) pareciam itens desativados e precisam se distinguir claramente dos itens clicáveis.

- [ ] Decisões de 20/11/2026 depois da QA, para a sessão de correção: aceitar data futura no lançamento manual, contando no saldo só quando a data chegar e aparecendo em Próximos (decisões, Tabela de transações); conferir que o saldo do cartão em Contas mostra só o já lançado até hoje, com parcelas futuras no comprometido (decisões, Contas).
- [ ] Categoria e tags padrão no beneficiário, para a sessão de correção: editáveis na tela de beneficiários; a sugestão ao digitar o beneficiário usa o padrão quando existir e a última vez quando não (decisões, Tags e beneficiários).
- [ ] Possível defeito da QA, para a sessão de correção investigar: antecipação de parcelas devolve 409 ("As parcelas ou a fatura atual mudaram") num cenário composto, depois de fechar a fatura anterior e lançar outra compra parcelada no mesmo cartão. Isolada, funciona. Detalhe em docs/qa/fase-1.md.
- [ ] QA complementar (Sessão N, Claude Code): refazer o mês simulado pela API com relógio fixo e gabarito escrito antes de rodar, e conferir por amostragem o que a Sessão M marcou como Ok.

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

## Ideias para depois das três fases (sem decisão)

- Importação pontual de extrato ou fatura (OFX ou CSV, quando o banco oferecer), separada da importação do histórico do Lunch Money. Diferenças: as transações entram como manuais e editáveis, passam por uma tela de revisão antes de salvar e são cruzadas com o que já foi lançado para não duplicar. Uso principal: achar a compra que faltou numa conferência de fatura. Baixa prioridade, porque o lançamento manual dá a melhor visão dos dados e os bancos não têm um padrão de exportação confiável.

- Análise dos dados, em duas partes. Primeiro, padrões por regra simples, sem IA, de graça e previsíveis: assinatura que mudou de preço, cobrança duplicada, categoria bem acima da média dos últimos meses, recorrente que não apareceu no mês e comparação com o mesmo mês do ano anterior. Isso cobre o principal e cabe nas fases 2 e 3. Depois, IA só para consultar e analisar, nunca para lançar ou categorizar (o lançamento continua manual e sem regras automáticas): perguntas livres sobre o histórico, resumo do mês em texto e leitura de fatura ou extrato em PDF ou print para achar a compra que faltou na conferência. O dono tende ao Workers AI, dentro da conta BFO, até para testar: tem franquia diária gratuita e os dados não saem da Cloudflare. A API do Claude fica como alternativa paga. Sem decisão, a ver depois.
